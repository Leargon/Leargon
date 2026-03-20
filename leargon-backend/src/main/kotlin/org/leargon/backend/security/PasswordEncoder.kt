package org.leargon.backend.security

import jakarta.inject.Singleton
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder

@Singleton
open class PasswordEncoder {
    private val encoder = BCryptPasswordEncoder(12)

    open fun encode(rawPassword: String): String =
        encoder.encode(rawPassword) ?: throw IllegalStateException("BCrypt encoding returned null")

    open fun matches(
        rawPassword: String,
        encodedPassword: String?
    ): Boolean = encoder.matches(rawPassword, encodedPassword)
}
