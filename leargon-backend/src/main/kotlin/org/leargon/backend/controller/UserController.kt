package org.leargon.backend.controller

import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.UserApi
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.ChangePasswordRequest
import org.leargon.backend.model.UpdateProfileRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class UserController(
    private val userService: UserService,
    private val securityService: SecurityService
) : UserApi {
    override fun getCurrentUser(): UserResponse {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        val user =
            userService
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        return userService.toUserResponse(user)
    }

    override fun updateProfile(
        @Valid @Body updateProfileRequest: UpdateProfileRequest
    ): UserResponse {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        val user =
            userService
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        val updatedUser = userService.updateProfile(user.id!!, updateProfileRequest)
        return userService.toUserResponse(updatedUser)
    }

    override fun changePassword(
        @Valid @Body changePasswordRequest: ChangePasswordRequest
    ) {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        val user =
            userService
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }
        userService.changePassword(user.id!!, changePasswordRequest)
    }
}
