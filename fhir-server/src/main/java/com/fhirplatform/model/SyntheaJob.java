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
@Document(collection = "synthea_jobs")
public class SyntheaJob {

    @Id
    private String id;

    private String status;

    private int populationSize;

    private String state;

    private String city;

    private Instant createdAt;

    private Instant completedAt;

    private int resourcesImported;

    private String errorMessage;

    public static final String PENDING = "PENDING";
    public static final String RUNNING = "RUNNING";
    public static final String COMPLETED = "COMPLETED";
    public static final String FAILED = "FAILED";
}
