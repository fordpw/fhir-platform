package com.fhirplatform.controller;

import com.fhirplatform.config.SecurityConfig;
import com.fhirplatform.entity.AppUser;
import com.fhirplatform.repository.FhirResourceRepository;
import com.fhirplatform.security.JwtAuthFilter;
import com.fhirplatform.security.JwtUtil;
import com.fhirplatform.security.RestAccessDeniedHandler;
import com.fhirplatform.security.RestAuthenticationEntryPoint;
import com.fhirplatform.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers user creation and the roles it will accept.
 *
 * Two regressions guarded here:
 *  - POST /api/admin/users did not exist at all, so the admin UI's "Create
 *    User" silently failed against a route that was never mapped.
 *  - The UI offered a role named USER, which the backend does not define, so
 *    such an account would have matched no authority.
 */
@WebMvcTest(controllers = AdminController.class)
@Import({
        SecurityConfig.class,
        JwtAuthFilter.class,
        JwtUtil.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class
})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-that-is-long-enough-for-hmac-sha256-signing-abcdefgh",
        "app.jwt.expiration=86400000"
})
class AdminUserEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private UserService userService;

    @MockBean
    private FhirResourceRepository fhirResourceRepository;

    private String adminToken() {
        return "Bearer " + jwtUtil.generateToken("admin", "ADMIN");
    }

    private static AppUser sampleUser(String username, String role) {
        return AppUser.builder()
                .id("507f1f77bcf86cd799439011")
                .username(username)
                .password("hashed")
                .role(role)
                .enabled(true)
                .createdAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("creating a user returns 201 with a string id")
    void createUserSucceeds() throws Exception {
        when(userService.findByUsername("newuser")).thenReturn(Optional.empty());
        when(userService.createUser(anyString(), anyString(), anyString()))
                .thenReturn(sampleUser("newuser", AppUser.ROLE_PRACTITIONER));

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"newuser","password":"pass-12345","role":"PRACTITIONER"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("newuser"))
                .andExpect(jsonPath("$.role").value("PRACTITIONER"))
                .andExpect(jsonPath("$.id").isString());
    }

    @Test
    @DisplayName("a duplicate username returns 409 and does not create anything")
    void duplicateUsernameConflicts() throws Exception {
        when(userService.findByUsername("existing"))
                .thenReturn(Optional.of(sampleUser("existing", AppUser.ROLE_ADMIN)));

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"existing","password":"pass-12345","role":"READONLY"}
                                """))
                .andExpect(status().isConflict());

        verify(userService, never()).createUser(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("the non-existent USER role is rejected with 400")
    void unknownRoleRejected() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"someone","password":"pass-12345","role":"USER"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid role: USER"));

        verify(userService, never()).createUser(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("creating a user requires authentication")
    void createUserRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"anon","password":"pass-12345","role":"ADMIN"}
                                """))
                .andExpect(status().isUnauthorized());

        verify(userService, never()).createUser(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("a READONLY caller cannot create users")
    void createUserRequiresAdminRole() throws Exception {
        String readonly = "Bearer " + jwtUtil.generateToken("bob", AppUser.ROLE_READONLY);

        mockMvc.perform(post("/api/admin/users")
                        .header("Authorization", readonly)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"someone","password":"pass-12345","role":"ADMIN"}
                                """))
                .andExpect(status().isForbidden());

        verify(userService, never()).createUser(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("every role the UI offers is accepted by the backend")
    void uiRolesAreAllValid() {
        // Guards the mismatch that shipped: the UI listed a USER role the
        // backend never defined. USER_ROLES in the frontend must mirror this set.
        org.assertj.core.api.Assertions.assertThat(AppUser.VALID_ROLES)
                .containsExactlyInAnyOrder("ADMIN", "PRACTITIONER", "READONLY");
        org.assertj.core.api.Assertions.assertThat(AppUser.isValidRole("USER")).isFalse();
        org.assertj.core.api.Assertions.assertThat(AppUser.isValidRole(null)).isFalse();
    }
}
