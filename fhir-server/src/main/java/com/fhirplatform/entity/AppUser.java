package com.fhirplatform.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class AppUser {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String password;

    private String role;

    @Builder.Default
    private boolean enabled = true;

    private Instant createdAt;

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_PRACTITIONER = "PRACTITIONER";
    public static final String ROLE_READONLY = "READONLY";

    public static final java.util.Set<String> VALID_ROLES =
            java.util.Set.of(ROLE_ADMIN, ROLE_PRACTITIONER, ROLE_READONLY);

    public static boolean isValidRole(String role) {
        return role != null && VALID_ROLES.contains(role);
    }
}
