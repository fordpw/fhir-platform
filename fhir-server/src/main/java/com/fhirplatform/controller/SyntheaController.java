package com.fhirplatform.controller;

import com.fhirplatform.dto.GenerateRequest;
import com.fhirplatform.model.SyntheaJob;
import com.fhirplatform.service.SyntheaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/synthea")
public class SyntheaController {

    private final SyntheaService syntheaService;

    public SyntheaController(SyntheaService syntheaService) {
        this.syntheaService = syntheaService;
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, String>> generate(@Valid @RequestBody GenerateRequest request) {
        String jobId = syntheaService.generateData(request.populationSize(), request.state(), request.city());
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("jobId", jobId, "status", "PENDING"));
    }

    @GetMapping("/jobs")
    public ResponseEntity<List<SyntheaJob>> listJobs() {
        return ResponseEntity.ok(syntheaService.findAllJobs());
    }

    @GetMapping("/jobs/{id}")
    public ResponseEntity<?> getJob(@PathVariable String id) {
        return syntheaService.findJobById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
