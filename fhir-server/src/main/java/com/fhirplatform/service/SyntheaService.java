package com.fhirplatform.service;

import ca.uhn.fhir.context.FhirContext;
import com.fhirplatform.model.SyntheaJob;
import org.hl7.fhir.r4.model.Bundle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

@Service
public class SyntheaService {

    private static final Logger log = LoggerFactory.getLogger(SyntheaService.class);

    /** Number of trailing Synthea output lines retained for failure diagnostics. */
    private static final int ERROR_TAIL_LINES = 20;

    private final MongoTemplate mongoTemplate;
    private final BundleImportService bundleImportService;
    private final FhirContext fhirContext;

    /**
     * Self-reference used to invoke {@link #runGeneration} through the Spring proxy.
     * Calling the {@code @Async} method directly via {@code this} would bypass the
     * proxy and run generation synchronously on the caller's HTTP request thread.
     */
    private final SyntheaService self;

    @Value("${app.synthea.jar-path}")
    private String syntheaJarPath;

    @Value("${app.synthea.output-directory}")
    private String outputDirectory;

    // Synthea's subprocess JVM has no heap size of its own by default: it derives
    // one from whatever memory the container's cgroup reports, which is shared
    // with (and already partly used by) this Spring Boot process. Under memory
    // pressure from a prior run that default has been observed to be too small,
    // failing Demographics.load with "OutOfMemoryError: Java heap space" even
    // though the requested population size was small. Sizing it explicitly makes
    // the subprocess's memory needs predictable and independent of the parent
    // JVM's current footprint.
    @Value("${app.synthea.heap-size}")
    private String syntheaHeapSize;

    public SyntheaService(MongoTemplate mongoTemplate,
                          BundleImportService bundleImportService,
                          FhirContext fhirContext,
                          @Lazy SyntheaService self) {
        this.mongoTemplate = mongoTemplate;
        this.bundleImportService = bundleImportService;
        this.fhirContext = fhirContext;
        this.self = self;
    }

    public String generateData(int populationSize, String state, String city) {
        SyntheaJob job = SyntheaJob.builder()
                .status(SyntheaJob.PENDING)
                .populationSize(populationSize)
                .state(state)
                .city(city)
                .createdAt(Instant.now())
                .build();

        job = mongoTemplate.save(job);
        String jobId = job.getId();

        self.runGeneration(jobId, populationSize, state, city);

        return jobId;
    }

    @Async("taskExecutor")
    public void runGeneration(String jobId, int populationSize, String state, String city) {
        Path jarPath = Path.of(syntheaJarPath).toAbsolutePath().normalize();

        // Fail fast with an actionable message rather than letting the subprocess
        // die with a bare "exit code 1".
        if (!Files.isRegularFile(jarPath)) {
            String message = "Synthea JAR not found at " + jarPath
                    + ". Download synthea-with-dependencies.jar from "
                    + "https://github.com/synthetichealth/synthea/releases and place it there, "
                    + "or set the SYNTHEA_JAR_PATH environment variable.";
            log.error("Synthea job {} cannot start: {}", jobId, message);
            updateJobFailed(jobId, message);
            return;
        }

        updateJobStatus(jobId, SyntheaJob.RUNNING);

        // Each job exports into its own directory so that repeated runs do not
        // re-import bundles produced by previous jobs.
        Path jobOutputDir = Path.of(outputDirectory).toAbsolutePath().normalize().resolve(jobId);

        try {
            Files.createDirectories(jobOutputDir);

            ProcessBuilder pb = new ProcessBuilder();
            pb.command().add("java");
            pb.command().add("-Xmx" + syntheaHeapSize);
            pb.command().add("-jar");
            pb.command().add(jarPath.toString());
            pb.command().add("-p");
            pb.command().add(String.valueOf(populationSize));
            pb.command().add("--exporter.fhir.export=true");
            pb.command().add("--exporter.baseDirectory=" + jobOutputDir);
            pb.command().add(state);

            if (city != null && !city.isBlank()) {
                pb.command().add(city);
            }

            pb.redirectErrorStream(true);
            pb.directory(jobOutputDir.toFile());

            log.info("Synthea job {} starting: {}", jobId, pb.command());

            Process process = pb.start();

            Deque<String> tail = new ArrayDeque<>(ERROR_TAIL_LINES);
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("[Synthea] {}", line);
                    if (tail.size() == ERROR_TAIL_LINES) {
                        tail.removeFirst();
                    }
                    tail.addLast(line);
                }
            }

            int exitCode = process.waitFor();

            if (exitCode != 0) {
                String details = String.join(System.lineSeparator(), tail).trim();
                String message = "Synthea exited with code " + exitCode
                        + (details.isEmpty() ? "" : System.lineSeparator() + details);
                updateJobFailed(jobId, message);
                return;
            }

            int totalImported = importGeneratedBundles(jobOutputDir.resolve("fhir"));

            SyntheaJob job = findJobById(jobId).orElse(null);
            if (job != null) {
                job.setStatus(SyntheaJob.COMPLETED);
                job.setCompletedAt(Instant.now());
                job.setResourcesImported(totalImported);
                mongoTemplate.save(job);
            }

            log.info("Synthea job {} completed. Imported {} resources.", jobId, totalImported);

        } catch (IOException e) {
            log.error("Synthea generation failed for job {}", jobId, e);
            updateJobFailed(jobId, e.getMessage());
        } catch (InterruptedException e) {
            log.error("Synthea generation interrupted for job {}", jobId, e);
            updateJobFailed(jobId, "Generation was interrupted");
            Thread.currentThread().interrupt();
        }
    }

    private int importGeneratedBundles(Path fhirOutputPath) {
        int totalImported = 0;

        if (!Files.isDirectory(fhirOutputPath)) {
            log.warn("Synthea FHIR output directory does not exist: {}", fhirOutputPath);
            return 0;
        }

        try (Stream<Path> files = Files.list(fhirOutputPath)) {
            List<Path> jsonFiles = files
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .toList();

            for (Path jsonFile : jsonFiles) {
                try {
                    String content = Files.readString(jsonFile);
                    Bundle bundle = fhirContext.newJsonParser().parseResource(Bundle.class, content);
                    totalImported += bundleImportService.importBundle(bundle);
                } catch (Exception e) {
                    log.error("Failed to import bundle file: {}", jsonFile, e);
                }
            }
        } catch (IOException e) {
            log.error("Failed to read Synthea output directory {}", fhirOutputPath, e);
        }

        return totalImported;
    }

    private void updateJobStatus(String jobId, String status) {
        findJobById(jobId).ifPresent(job -> {
            job.setStatus(status);
            mongoTemplate.save(job);
        });
    }

    private void updateJobFailed(String jobId, String errorMessage) {
        findJobById(jobId).ifPresent(job -> {
            job.setStatus(SyntheaJob.FAILED);
            job.setCompletedAt(Instant.now());
            job.setErrorMessage(errorMessage);
            mongoTemplate.save(job);
        });
    }

    public Optional<SyntheaJob> findJobById(String jobId) {
        return Optional.ofNullable(mongoTemplate.findById(jobId, SyntheaJob.class));
    }

    public List<SyntheaJob> findAllJobs() {
        return mongoTemplate.findAll(SyntheaJob.class);
    }
}
