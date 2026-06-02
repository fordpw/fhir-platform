package com.fhirplatform.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record GenerateRequest(
        @Min(1) int populationSize,
        @NotBlank String state,
        String city
) {}
