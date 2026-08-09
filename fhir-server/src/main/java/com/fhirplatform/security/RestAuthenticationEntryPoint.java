package com.fhirplatform.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

/**
 * Returns 401 for requests that carry no usable credentials.
 *
 * <p>Without an explicit entry point Spring Security falls back to
 * {@code Http403ForbiddenEntryPoint}, which makes an expired session
 * indistinguishable from a genuine permission failure. Clients cannot then tell
 * "sign in again" from "you may not do this", so a lapsed token silently breaks
 * every authenticated request instead of prompting a re-login.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        Object recorded = request.getAttribute(JwtAuthFilter.JWT_ERROR_ATTRIBUTE);
        String code = recorded instanceof String s ? s : "unauthorized";

        String message = switch (code) {
            case JwtAuthFilter.ERROR_TOKEN_EXPIRED ->
                    "Your session has expired. Please sign in again.";
            case JwtAuthFilter.ERROR_INVALID_TOKEN ->
                    "Your session is no longer valid. Please sign in again.";
            default ->
                    "Authentication is required to access this resource.";
        };

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getOutputStream(),
                Map.of("error", message, "code", code)
        );
    }
}
