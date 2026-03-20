package org.leargon.backend.controller

import io.micronaut.context.annotation.Value
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.token.generator.TokenGenerator
import jakarta.annotation.Nullable
import jakarta.validation.Valid
import org.leargon.backend.api.AuthenticationApi
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.AuthResponse
import org.leargon.backend.model.AzureConfigResponse
import org.leargon.backend.model.AzureLoginRequest
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.service.AuthenticationService
import org.leargon.backend.service.AzureAuthService
import org.leargon.backend.service.UserService
import java.time.Instant

@Controller
@Secured(SecurityRule.IS_ANONYMOUS)
open class AuthenticationController(
    private val userService: UserService,
    private val authenticationService: AuthenticationService,
    private val tokenGenerator: TokenGenerator,
    private val userMapper: UserMapper,
    @param:Nullable private val azureAuthService: AzureAuthService?,
    @param:Value("\${azure.tenant-id:}") private val azureTenantId: String,
    @param:Value("\${azure.client-id:}") private val azureClientId: String
) : AuthenticationApi {
    companion object {
        private const val TOKEN_EXPIRATION_SECONDS = 3600L
    }

    private fun isAzureEnabled(): Boolean = azureAuthService != null && azureTenantId.isNotEmpty() && azureClientId.isNotEmpty()

    override fun signup(
        @Valid @Body signupRequest: SignupRequest
    ): AuthResponse {
        if (isAzureEnabled()) {
            throw AuthenticationException("Signup is disabled when Azure authentication is configured")
        }
        val user = userService.createUser(signupRequest)
        return generateAuthResponse(user)
    }

    override fun login(
        @Valid @Body loginRequest: LoginRequest
    ): AuthResponse {
        var user = authenticationService.authenticate(loginRequest)
        user = userService.updateLastLogin(user.id!!)
        return generateAuthResponse(user)
    }

    override fun azureLogin(
        @Valid @Body azureLoginRequest: AzureLoginRequest
    ): AuthResponse {
        if (azureAuthService == null) {
            throw AuthenticationException("Azure login is not configured")
        }
        val user = azureAuthService.authenticateWithAzure(azureLoginRequest.idToken)
        return generateAuthResponse(user)
    }

    override fun getAzureConfig(): AzureConfigResponse {
        val enabled = azureAuthService != null && azureTenantId.isNotEmpty() && azureClientId.isNotEmpty()
        val response = AzureConfigResponse(enabled)
        if (enabled) {
            response.tenantId(azureTenantId)
            response.clientId(azureClientId)
        }
        return response
    }

    private fun generateAuthResponse(user: org.leargon.backend.domain.User): AuthResponse {
        val roles = userService.getUserRoles(user)

        val claims =
            mapOf(
                "sub" to user.email,
                "roles" to roles,
                "userId" to user.id,
                "email" to user.email,
                "username" to user.username,
                "iat" to Instant.now().epochSecond
            )

        val token =
            tokenGenerator
                .generateToken(claims)
                .orElseThrow { ResourceNotFoundException("Failed to generate authentication token") }

        return AuthResponse(
            token,
            "Bearer",
            TOKEN_EXPIRATION_SECONDS.toInt(),
            userMapper.toUserResponse(user)
        )
    }
}
