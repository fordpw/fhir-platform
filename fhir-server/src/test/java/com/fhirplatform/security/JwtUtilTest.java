package com.fhirplatform.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the token classification behind the 401 handling.
 *
 * An expired session must be distinguishable from a malformed or tampered
 * token, because the two produce different messages to the user. Before this
 * existed, {@code JwtAuthFilter} treated every failure identically and the API
 * answered 403, leaving the UI unable to tell "sign in again" from "not
 * allowed".
 */
class JwtUtilTest {

    private static final String SECRET =
            "test-secret-that-is-long-enough-for-hmac-sha256-signing-abcdefgh";
    private static final long ONE_DAY_MS = 86_400_000L;

    private final JwtUtil jwtUtil = new JwtUtil(SECRET, ONE_DAY_MS);

    @Test
    @DisplayName("a freshly issued token is VALID and round-trips its claims")
    void freshTokenIsValid() {
        String token = jwtUtil.generateToken("alice", "ADMIN");

        assertThat(jwtUtil.checkToken(token)).isEqualTo(JwtUtil.TokenStatus.VALID);
        assertThat(jwtUtil.isTokenValid(token)).isTrue();
        assertThat(jwtUtil.extractUsername(token)).isEqualTo("alice");
        assertThat(jwtUtil.extractRole(token)).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("an expired token reports EXPIRED, not merely invalid")
    void expiredTokenIsDistinguishable() {
        // Negative lifetime yields an expiry in the past.
        JwtUtil alreadyExpired = new JwtUtil(SECRET, -1000L);
        String token = alreadyExpired.generateToken("alice", "ADMIN");

        assertThat(jwtUtil.checkToken(token)).isEqualTo(JwtUtil.TokenStatus.EXPIRED);
        assertThat(jwtUtil.isTokenValid(token)).isFalse();
    }

    @Test
    @DisplayName("a malformed token reports INVALID")
    void malformedTokenIsInvalid() {
        assertThat(jwtUtil.checkToken("not.a.jwt")).isEqualTo(JwtUtil.TokenStatus.INVALID);
        assertThat(jwtUtil.checkToken("")).isEqualTo(JwtUtil.TokenStatus.INVALID);
    }

    @Test
    @DisplayName("a token signed with a different key reports INVALID")
    void tokenFromAnotherSecretIsInvalid() {
        // This is the cross-environment case: before APP_JWT_SECRET was wired up
        // correctly, dev and staging shared a key and each accepted the other's
        // tokens. With distinct secrets the foreign token must be rejected.
        SecretKey otherKey = Keys.hmacShaKeyFor(
                "a-completely-different-secret-value-of-sufficient-length-1234"
                        .getBytes(StandardCharsets.UTF_8));

        String foreign = Jwts.builder()
                .subject("mallory")
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ONE_DAY_MS))
                .signWith(otherKey)
                .compact();

        assertThat(jwtUtil.checkToken(foreign)).isEqualTo(JwtUtil.TokenStatus.INVALID);
    }

    @Test
    @DisplayName("role is carried through so authorities can be derived")
    void nonAdminRoleRoundTrips() {
        String token = jwtUtil.generateToken("bob", "READONLY");

        assertThat(jwtUtil.checkToken(token)).isEqualTo(JwtUtil.TokenStatus.VALID);
        assertThat(jwtUtil.extractRole(token)).isEqualTo("READONLY");
    }
}
