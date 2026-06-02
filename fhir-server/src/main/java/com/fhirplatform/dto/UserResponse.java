package com.fhirplatform.dto;

import com.fhirplatform.entity.AppUser;

import java.time.Instant;

public record UserResponse(
        String id,
        String username,
        String role,
        boolean enabled,
        Instant createdAt
) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled(),
                user.getCreatedAt()
        );
    }
}
