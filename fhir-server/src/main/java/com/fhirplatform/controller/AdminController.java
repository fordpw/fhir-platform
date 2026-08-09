package com.fhirplatform.controller;

import com.fhirplatform.dto.RegisterRequest;
import com.fhirplatform.dto.StatsResponse;
import com.fhirplatform.dto.UserResponse;
import com.fhirplatform.dto.UserUpdateRequest;
import com.fhirplatform.entity.AppUser;
import com.fhirplatform.model.FhirResourceDocument;
import com.fhirplatform.repository.FhirResourceRepository;
import com.fhirplatform.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final FhirResourceRepository fhirResourceRepository;

    private static final List<String> RESOURCE_TYPES = List.of(
            "Patient", "Practitioner", "Organization", "Encounter",
            "Condition", "Observation", "MedicationRequest",
            "AllergyIntolerance", "Immunization", "Procedure",
            "DiagnosticReport", "CarePlan", "Claim", "Coverage",
            "ExplanationOfBenefit"
    );

    public AdminController(UserService userService, FhirResourceRepository fhirResourceRepository) {
        this.userService = userService;
        this.fhirResourceRepository = fhirResourceRepository;
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> listUsers() {
        List<UserResponse> users = userService.findAll()
                .stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /**
     * Creates a user. The admin UI has always called this endpoint, but it did not
     * exist, so user creation silently failed. Account creation is admin-only:
     * public self-registration previously allowed anyone to request the ADMIN role.
     */
    @PostMapping("/users")
    public ResponseEntity<?> createUser(@Valid @RequestBody RegisterRequest request) {
        if (!AppUser.isValidRole(request.role())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid role: " + request.role(),
                    "validRoles", AppUser.VALID_ROLES
            ));
        }

        if (userService.findByUsername(request.username()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Username already exists"));
        }

        AppUser created = userService.createUser(
                request.username(), request.password(), request.role());

        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(created));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUser(@PathVariable String id) {
        return userService.findById(id)
                .map(user -> ResponseEntity.ok(UserResponse.from(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable String id, @RequestBody UserUpdateRequest request) {
        if (request.role() != null && !AppUser.isValidRole(request.role())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid role: " + request.role(),
                    "validRoles", AppUser.VALID_ROLES
            ));
        }

        try {
            AppUser updated = userService.updateUser(id, request);
            return ResponseEntity.ok(UserResponse.from(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats() {
        Map<String, Long> resourceCounts = new LinkedHashMap<>();
        long totalResources = 0;

        for (String resourceType : RESOURCE_TYPES) {
            String collectionName = FhirResourceDocument.collectionName(resourceType);
            long count = fhirResourceRepository.count(collectionName);
            resourceCounts.put(resourceType, count);
            totalResources += count;
        }

        return ResponseEntity.ok(new StatsResponse(resourceCounts, totalResources));
    }
}
