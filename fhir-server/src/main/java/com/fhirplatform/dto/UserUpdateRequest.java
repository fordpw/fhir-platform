package com.fhirplatform.dto;

public record UserUpdateRequest(
        String password,
        String role,
        Boolean enabled
) {}
