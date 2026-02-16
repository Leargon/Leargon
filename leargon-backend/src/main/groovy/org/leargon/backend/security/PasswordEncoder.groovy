package org.leargon.backend.security

import jakarta.inject.Singleton
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder

/**
 * Password encoding service using BCrypt hashing algorithm.
 *
 * Security features:
 * - BCrypt strength: 12 (2^12 = 4096 rounds)
 * - Random salt generated per password
 * - Industry-standard secure password hashing
 *
 * Important: BCrypt has a 72-byte input limit. Longer passwords are truncated.
 * Application should validate password length before encoding.
 */
@Singleton
class PasswordEncoder {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12)

    /**
     * Encode (hash) a raw password using BCrypt.
     * Each call generates a unique hash due to random salt.
     *
     * @param rawPassword Plain text password to encode
     * @return BCrypt hash of the password (60 characters)
     */
    String encode(String rawPassword) {
        return encoder.encode(rawPassword)
    }

    /**
     * Verify if a raw password matches an encoded hash.
     * Uses constant-time comparison to prevent timing attacks.
     *
     * @param rawPassword Plain text password to verify
     * @param encodedPassword BCrypt hash to compare against
     * @return true if password matches, false otherwise
     */
    boolean matches(String rawPassword, String encodedPassword) {
        return encoder.matches(rawPassword, encodedPassword)
    }
}
