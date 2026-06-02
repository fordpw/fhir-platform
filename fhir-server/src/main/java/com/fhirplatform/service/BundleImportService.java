package com.fhirplatform.service;

import ca.uhn.fhir.context.FhirContext;
import com.fhirplatform.model.FhirResourceDocument;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class BundleImportService {

    private static final Logger log = LoggerFactory.getLogger(BundleImportService.class);

    private final FhirResourceRepository repository;
    private final FhirContext fhirContext;

    public BundleImportService(FhirResourceRepository repository, FhirContext fhirContext) {
        this.repository = repository;
        this.fhirContext = fhirContext;
    }

    public int importBundle(Bundle bundle) {
        if (bundle == null || bundle.getEntry() == null) {
            return 0;
        }

        Map<String, String> idMap = new HashMap<>();
        int importedCount = 0;

        // First pass: assign IDs
        for (Bundle.BundleEntryComponent entry : bundle.getEntry()) {
            Resource resource = entry.getResource();
            if (resource == null) {
                continue;
            }

            String fullUrl = entry.getFullUrl();
            String newId = UUID.randomUUID().toString();

            if (fullUrl != null && !fullUrl.isEmpty()) {
                idMap.put(fullUrl, resource.getResourceType().name() + "/" + newId);
            }

            resource.setId(newId);
        }

        // Second pass: replace references and save
        for (Bundle.BundleEntryComponent entry : bundle.getEntry()) {
            Resource resource = entry.getResource();
            if (resource == null) {
                continue;
            }

            Bundle.BundleEntryRequestComponent request = entry.getRequest();
            if (request != null && request.getMethod() != null) {
                Bundle.HTTPVerb method = request.getMethod();
                if (method != Bundle.HTTPVerb.POST && method != Bundle.HTTPVerb.PUT) {
                    continue;
                }
            }

            try {
                String resourceJson = fhirContext.newJsonParser().encodeResourceToString(resource);

                // Replace UUID references with assigned IDs
                for (Map.Entry<String, String> idEntry : idMap.entrySet()) {
                    resourceJson = resourceJson.replace(idEntry.getKey(), idEntry.getValue());
                }

                org.bson.Document bsonContent = org.bson.Document.parse(resourceJson);
                String resourceType = resource.getResourceType().name();
                String collectionName = FhirResourceDocument.collectionName(resourceType);

                FhirResourceDocument doc = FhirResourceDocument.builder()
                        .id(resource.getIdElement().getIdPart())
                        .resourceType(resourceType)
                        .versionId(1)
                        .lastUpdated(Instant.now())
                        .content(bsonContent)
                        .build();

                repository.save(doc, collectionName);
                importedCount++;
            } catch (Exception e) {
                log.error("Failed to import resource: {}/{}", resource.getResourceType(), resource.getId(), e);
            }
        }

        log.info("Imported {} resources from bundle", importedCount);
        return importedCount;
    }
}
