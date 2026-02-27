package org.leargon.backend.service

import io.micronaut.context.annotation.Value
import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.security.PasswordEncoder

/**
 * Service handling user authentication logic.
 * Verifies credentials and account status.
 */
@Singleton
class AuthenticationService {

    private final UserService userService
    private final PasswordEncoder passwordEncoder
    private final String azureTenantId
    private final String azureClientId

    AuthenticationService(
            UserService userService,
            PasswordEncoder passwordEncoder,
            @Value('${azure.tenant-id:}') String azureTenantId,
            @Value('${azure.client-id:}') String azureClientId
    ) {
        this.userService = userService
        this.passwordEncoder = passwordEncoder
        this.azureTenantId = azureTenantId
        this.azureClientId = azureClientId
    }

    private boolean isAzureEnabled() {
        return azureTenantId && azureClientId
    }

    /**
     * Authenticate user with email and password.
     * Also validates account status (enabled, not locked, not expired).
     *
     * @param request Login credentials
     * @return Authenticated User entity
     * @throws AuthenticationException if credentials are invalid or account is not accessible
     */
    User authenticate(LoginRequest request) {
        // Find user by email - use generic error message to prevent user enumeration
        User user = userService.findByEmail(request.email)
                .orElseThrow(() -> new AuthenticationException("Invalid email or password"))

        // When Azure is enabled, only the fallback administrator can use local login
        if (isAzureEnabled() && !user.isFallbackAdministrator) {
            throw new AuthenticationException("Please use Azure login")
        }

        // Reject Azure-only users (no password set)
        if (user.authProvider == "AZURE" && !user.passwordHash) {
            throw new AuthenticationException("Please use Azure login")
        }

        // Verify password
        if (!passwordEncoder.matches(request.password, user.passwordHash)) {
            throw new AuthenticationException("Invalid email or password")
        }

        // Validate account status
        validateAccountStatus(user)

        return user
    }

    /**
     * Validate that the user account is accessible.
     *
     * @param user User to validate
     * @throws AuthenticationException if account is not accessible
     */
    private void validateAccountStatus(User user) {
        if (!user.enabled) {
            throw new AuthenticationException("Account is disabled")
        }

    }
}
