package com.fhirplatform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    /**
     * Request attribute carrying why bearer authentication failed, so
     * {@link RestAuthenticationEntryPoint} can return an accurate reason code.
     */
    public static final String JWT_ERROR_ATTRIBUTE = "com.fhirplatform.jwtError";

    public static final String ERROR_TOKEN_EXPIRED = "token_expired";
    public static final String ERROR_INVALID_TOKEN = "invalid_token";

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            JwtUtil.TokenStatus status = jwtUtil.checkToken(token);

            if (status == JwtUtil.TokenStatus.VALID) {
                String username = jwtUtil.extractUsername(token);
                String role = jwtUtil.extractRole(token);

                List<SimpleGrantedAuthority> authorities = List.of(
                        new SimpleGrantedAuthority("ROLE_" + role)
                );

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(username, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);
            } else {
                // Leave the request unauthenticated and let the entry point reject it,
                // but record the reason so the client can tell an expired session apart
                // from a bad token.
                request.setAttribute(
                        JWT_ERROR_ATTRIBUTE,
                        status == JwtUtil.TokenStatus.EXPIRED ? ERROR_TOKEN_EXPIRED : ERROR_INVALID_TOKEN
                );
            }
        }

        filterChain.doFilter(request, response);
    }
}
