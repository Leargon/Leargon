package org.leargon.backend.controller

import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.UserApi
import org.leargon.backend.domain.User
import org.leargon.backend.model.ChangePasswordRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.service.UserService

/**
 * User management controller for authenticated operations.
 * All endpoints require valid JWT authentication.
 */
@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
class UserController implements UserApi {

    private final UserService userService
    private final SecurityService securityService

    UserController(UserService userService, SecurityService securityService) {
        this.userService = userService
        this.securityService = securityService
    }

    /**
     * Get current authenticated user's profile information.
     *
     * @return UserResponse with current user's details
     * @throws ResourceNotFoundException if user not found
     */
    @Override
    UserResponse getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
        return userService.toUserResponse(user)
    }

    /**
     * Change current user's password.
     * Requires current password for verification.
     *
     * @param changePasswordRequest Password change request with current and new passwords
     * @throws ResourceNotFoundException if user not found
     * @throws AuthenticationException if current password is incorrect
     */
    @Override
    void changePassword(@Valid @Body ChangePasswordRequest changePasswordRequest) {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))

        userService.changePassword(user.id, changePasswordRequest)
    }
}
