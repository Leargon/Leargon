package org.leargon.backend.service

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

    AuthenticationService(UserService userService, PasswordEncoder passwordEncoder) {
        this.userService = userService
        this.passwordEncoder = passwordEncoder
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

        if (user.accountLocked) {
            throw new AuthenticationException("Account is locked")
        }

        if (user.accountExpired) {
            throw new AuthenticationException("Account is expired")
        }

        if (user.passwordExpired) {
            throw new AuthenticationException("Password is expired")
        }
    }
}
