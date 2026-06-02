package com.fhirplatform.service;

import com.fhirplatform.dto.UserUpdateRequest;
import com.fhirplatform.entity.AppUser;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final MongoTemplate mongoTemplate;
    private final PasswordEncoder passwordEncoder;

    public UserService(MongoTemplate mongoTemplate, PasswordEncoder passwordEncoder) {
        this.mongoTemplate = mongoTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    public AppUser createUser(String username, String password, String role) {
        AppUser user = AppUser.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .role(role)
                .enabled(true)
                .createdAt(Instant.now())
                .build();
        return mongoTemplate.save(user);
    }

    public Optional<AppUser> findByUsername(String username) {
        Query query = new Query(Criteria.where("username").is(username));
        return Optional.ofNullable(mongoTemplate.findOne(query, AppUser.class));
    }

    public Optional<AppUser> findById(String id) {
        return Optional.ofNullable(mongoTemplate.findById(id, AppUser.class));
    }

    public List<AppUser> findAll() {
        return mongoTemplate.findAll(AppUser.class);
    }

    public AppUser updateUser(String id, UserUpdateRequest updates) {
        AppUser user = mongoTemplate.findById(id, AppUser.class);
        if (user == null) {
            throw new IllegalArgumentException("User not found: " + id);
        }

        if (updates.password() != null && !updates.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(updates.password()));
        }
        if (updates.role() != null && !updates.role().isBlank()) {
            user.setRole(updates.role());
        }
        if (updates.enabled() != null) {
            user.setEnabled(updates.enabled());
        }

        return mongoTemplate.save(user);
    }

    public void deleteUser(String id) {
        Query query = new Query(Criteria.where("_id").is(id));
        mongoTemplate.remove(query, AppUser.class);
    }

    @PostConstruct
    public void initDefaultAdmin() {
        long userCount = mongoTemplate.count(new Query(), AppUser.class);
        if (userCount == 0) {
            createUser("admin", "admin", AppUser.ROLE_ADMIN);
            log.info("Default admin user created (username: admin)");
        }
    }
}
