package com.fhirplatform.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document
public class FhirResourceDocument {

    @Id
    private String id;

    private String resourceType;

    @Builder.Default
    private int versionId = 1;

    private Instant lastUpdated;

    private org.bson.Document content;

    public static String collectionName(String resourceType) {
        return resourceType.toLowerCase();
    }
}
