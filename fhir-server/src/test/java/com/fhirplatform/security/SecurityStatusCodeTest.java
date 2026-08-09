package com.fhirplatform.security;

import com.fhirplatform.config.SecurityConfig;
import com.fhirplatform.controller.AdminController;
import com.fhirplatform.repository.FhirResourceRepository;
import com.fhirplatform.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Locks in the distinction between "not authenticated" and "not permitted".
 *
 * Regression guard: with no AuthenticationEntryPoint configured, Spring falls
 * back to Http403ForbiddenEntryPoint and answers unauthenticated requests with
 * 403. That made an expired session indistinguishable from a permission
 * failure, so the admin UI silently broke instead of prompting a re-login.
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
class SecurityStatusCodeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private UserService userService;

    @MockBean
    private FhirResourceRepository fhirResourceRepository;

    @Test
    @DisplayName("no credentials -> 401 unauthorized (not 403)")
    void noCredentialsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @Test
    @DisplayName("malformed token -> 401 invalid_token")
    void malformedTokenIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", "Bearer not.a.real.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_token"));
    }

    @Test
    @DisplayName("expired token -> 401 token_expired, so the UI can say 'session expired'")
    void expiredTokenIsReportedAsExpired() throws Exception {
        JwtUtil expiredIssuer = new JwtUtil(
                "test-secret-that-is-long-enough-for-hmac-sha256-signing-abcdefgh", -1000L);
        String expired = expiredIssuer.generateToken("admin", "ADMIN");

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("token_expired"));
    }

    @Test
    @DisplayName("authenticated but wrong role -> 403 forbidden, distinct from 401")
    void insufficientRoleIsForbidden() throws Exception {
        String readonly = jwtUtil.generateToken("bob", "READONLY");

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", "Bearer " + readonly))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    @DisplayName("valid admin token is accepted")
    void adminTokenIsAccepted() throws Exception {
        String admin = jwtUtil.generateToken("admin", "ADMIN");

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("public FHIR routes need no credentials")
    void fhirRoutesArePublic() throws Exception {
        // No FHIR servlet in this slice, so the request 404s at routing --
        // the point is that security does not reject it with 401/403.
        mockMvc.perform(get("/fhir/Patient"))
                .andExpect(result -> {
                    int s = result.getResponse().getStatus();
                    if (s == 401 || s == 403) {
                        throw new AssertionError(
                                "public FHIR route was rejected by security with " + s);
                    }
                });
    }
}
