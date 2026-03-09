package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import jakarta.validation.Valid
import org.leargon.backend.api.AdministrationApi
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.service.UserService

@Controller
open class AdministrationController(
    private val userService: UserService
) : AdministrationApi {

    @Secured("ROLE_ADMIN")
    override fun createUser(@Valid @Body signupRequest: SignupRequest): HttpResponse<UserResponse> {
        val user = userService.createUser(signupRequest)
        return HttpResponse.created(userService.toUserResponse(user))
    }

    @Secured("ROLE_ADMIN")
    override fun getAllUsers(): List<UserResponse> =
        userService.getAllUsersAsResponses()

    @Secured("ROLE_ADMIN")
    override fun getUserById(id: Long): UserResponse {
        val user = userService.getUserById(id)
        return userService.toUserResponse(user)
    }

    @Secured("ROLE_ADMIN")
    override fun updateUser(id: Long, @Valid @Body updateUserRequest: UpdateUserRequest): UserResponse {
        val user = userService.updateUser(id, updateUserRequest)
        return userService.toUserResponse(user)
    }

    @Secured("ROLE_ADMIN")
    override fun deleteUser(id: Long): HttpResponse<Void> {
        userService.deleteUser(id)
        return HttpResponse.status(HttpStatus.NO_CONTENT)
    }

    @Secured("ROLE_ADMIN")
    override fun enableUser(id: Long): UserResponse {
        val request = UpdateUserRequest().apply { enabled = true }
        val user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    @Secured("ROLE_ADMIN")
    override fun disableUser(id: Long): UserResponse {
        val request = UpdateUserRequest().apply { enabled = false }
        val user = userService.updateUser(id, request)
        return userService.toUserResponse(user)
    }

    @Secured("ROLE_ADMIN")
    override fun administrationChangePassword(id: Long, @Body @Valid administrationChangePasswordRequest: AdministrationChangePasswordRequest) {
        userService.adminChangePassword(id, administrationChangePasswordRequest)
    }
}
