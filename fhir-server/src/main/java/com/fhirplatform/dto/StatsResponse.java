package com.fhirplatform.dto;

import java.util.Map;

public record StatsResponse(
        Map<String, Long> resourceCounts,
        long totalResources
) {}
