package com.fhirplatform.service;

import ca.uhn.fhir.context.FhirContext;
import com.fhirplatform.model.SyntheaJob;
import org.hl7.fhir.r4.model.Bundle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

@Service
public class SyntheaService {

    private static final Logger log = LoggerFactory.getLogger(SyntheaService.class);

    private final MongoTemplate mongoTemplate;
    private final BundleImportService bundleImportService;
    private final FhirContext fhirContext;

    @Value("${app.synthea.jar-path}")
    private String syntheaJarPath;

    @Value("${app.synthea.output-directory}")
    private String outputDirectory;

    public SyntheaService(MongoTemplate mongoTemplate, BundleImportService bundleImportService, FhirContext fhirContext) {
        this.mongoTemplate = mongoTemplate;
        this.bundleImportService = bundleImportService;
        this.fhirContext = fhirContext;
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

        runGeneration(jobId, populationSize, state, city);

        return jobId;
    }

    @Async("taskExecutor")
    public void runGeneration(String jobId, int populationSize, String state, String city) {
        updateJobStatus(jobId, SyntheaJob.RUNNING);

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "java", "-jar", syntheaJarPath,
                    "-p", String.valueOf(populationSize),
                    "--exporter.fhir.export=true",
                    state
            );

            if (city != null && !city.isBlank()) {
                pb.command().add(city);
            }

            pb.redirectErrorStream(true);
            pb.directory(new File("."));

            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("[Synthea] {}", line);
                }
            }

            int exitCode = process.waitFor();

            if (exitCode != 0) {
                updateJobFailed(jobId, "Synthea exited with code: " + exitCode);
                return;
            }

            int totalImported = importGeneratedBundles();

            SyntheaJob job = findJobById(jobId).orElse(null);
            if (job != null) {
                job.setStatus(SyntheaJob.COMPLETED);
                job.setCompletedAt(Instant.now());
                job.setResourcesImported(totalImported);
                mongoTemplate.save(job);
            }

            log.info("Synthea job {} completed. Imported {} resources.", jobId, totalImported);

        } catch (IOException | InterruptedException e) {
            log.error("Synthea generation failed for job {}", jobId, e);
            updateJobFailed(jobId, e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private int importGeneratedBundles() {
        int totalImported = 0;
        Path outputPath = Path.of(outputDirectory);

        if (!Files.exists(outputPath)) {
            log.warn("Synthea output directory does not exist: {}", outputDirectory);
            return 0;
        }

        try (Stream<Path> files = Files.list(outputPath)) {
            List<Path> jsonFiles = files
                    .filter(p -> p.toString().endsWith(".json"))
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
            log.error("Failed to read Synthea output directory", e);
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
