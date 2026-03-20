package org.leargon.backend.service

import io.micronaut.context.annotation.Value
import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.security.PasswordEncoder

@Singleton
open class AuthenticationService(
    private val userService: UserService,
    private val passwordEncoder: PasswordEncoder,
    @param:Value("\${azure.tenant-id:}") private val azureTenantId: String,
    @param:Value("\${azure.client-id:}") private val azureClientId: String
) {
    private fun isAzureEnabled(): Boolean = azureTenantId.isNotEmpty() && azureClientId.isNotEmpty()

    open fun authenticate(request: LoginRequest): User {
        val user =
            userService
                .findByEmail(request.email)
                .orElseThrow { AuthenticationException("Invalid email or password") }

        if (isAzureEnabled() && !user.isFallbackAdministrator) {
            throw AuthenticationException("Please use Azure login")
        }

        if (user.authProvider == "AZURE" && user.passwordHash.isNullOrEmpty()) {
            throw AuthenticationException("Please use Azure login")
        }

        if (!passwordEncoder.matches(request.password, user.passwordHash)) {
            throw AuthenticationException("Invalid email or password")
        }

        validateAccountStatus(user)
        return user
    }

    private fun validateAccountStatus(user: User) {
        if (!user.enabled) {
            throw AuthenticationException("Account is disabled")
        }
    }
}
