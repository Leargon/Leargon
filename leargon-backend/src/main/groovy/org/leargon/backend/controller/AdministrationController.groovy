package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import jakarta.validation.Valid
import org.leargon.backend.api.AdministrationApi
import org.leargon.backend.domain.User
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.service.UserService

/**
 * Administration controller for user management operations.
 * All endpoints require ROLE_ADMIN authorization.
 */
@Controller
class AdministrationController implements AdministrationApi {

    private final UserService userService

    AdministrationController(UserService userService) {
        this.userService = userService
    }

    /**
     * Create a new local user account.
     * Works even when Azure authentication is configured.
     *
     * @param signupRequest User creation request
     * @return Created user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    HttpResponse<UserResponse> createUser(@Valid @Body SignupRequest signupRequest) {
        User user = userService.createUser(signupRequest)
        return HttpResponse.created(userService.toUserResponse(user))
    }

    /**
     * Get all users in the system.
     *
     * @return List of all users
     */
    @Override
    @Secured("ROLE_ADMIN")
    List<UserResponse> getAllUsers() {
        return userService.getAllUsersAsResponses()
    }

    /**
     * Get a specific user by ID.
     *
     * @param id User ID
     * @return User details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse getUserById(Long id) {
        User user = userService.getUserById(id)
        return userService.toUserResponse(user)
    }

    /**
     * Update user details.
     * Allows updating email, username, names, status, and roles.
     *
     * @param id User ID
     * @param updateUserRequest Update request with new values
     * @return Updated user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse updateUser(Long id, @Valid @Body UpdateUserRequest updateUserRequest) {
        User user = userService.updateUser(id, updateUserRequest)
        return userService.toUserResponse(user)
    }

    /**
     * Delete a user from the system.
     *
     * @param id User ID
     * @return 204 No Content
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse deleteUser(Long id) {
        User user = userService.deleteUser(id)
        return userService.toUserResponse(user)
    }

    /**
     * Lock a user account.
     *
     * @param id User ID
     * @return Updated user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse lockUser(Long id) {
        UpdateUserRequest request = new UpdateUserRequest(accountLocked: true)
        User user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    /**
     * Unlock a user account.
     *
     * @param id User ID
     * @return Updated user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse unlockUser(Long id) {
        UpdateUserRequest request = new UpdateUserRequest(accountLocked: false)
        User user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    /**
     * Enable a user account.
     *
     * @param id User ID
     * @return Updated user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse enableUser(Long id) {
        UpdateUserRequest request = new UpdateUserRequest(enabled: true)
        User user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    /**
     * Disable a user account.
     *
     * @param id User ID
     * @return Updated user details
     */
    @Override
    @Secured("ROLE_ADMIN")
    UserResponse disableUser(Long id) {
        UpdateUserRequest request = new UpdateUserRequest(enabled: false)
        User user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    /**
     * Change user password (admin only).
     * Admin can reset password without knowing current password.
     *
     * @param id User ID
     * @param adminChangePasswordRequest Password change request with new password
     */
    @Override
    @Secured("ROLE_ADMIN")
    void administrationChangePassword(Long id, @Body @Valid AdministrationChangePasswordRequest administrationChangePasswordRequest) {
        userService.adminChangePassword(id, administrationChangePasswordRequest)
    }
}
