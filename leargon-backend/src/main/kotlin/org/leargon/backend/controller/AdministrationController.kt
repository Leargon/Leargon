package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.AdministrationApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.FieldConfigurationDefinition
import org.leargon.backend.model.FieldConfigurationEntry
import org.leargon.backend.model.MethodologyConfigEntry
import org.leargon.backend.model.OrganisationSettingsRequest
import org.leargon.backend.model.OrganisationSettingsResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.model.UserSummaryResponse
import org.leargon.backend.service.FieldConfigurationService
import org.leargon.backend.service.MethodologyConfigurationService
import org.leargon.backend.service.OrganisationSettingsService
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
open class AdministrationController(
    private val userService: UserService,
    private val fieldConfigurationService: FieldConfigurationService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val organisationSettingsService: OrganisationSettingsService,
    private val roleService: RoleService,
    private val securityService: SecurityService
) : AdministrationApi {
    @Secured("ROLE_ADMIN")
    override fun createUser(
        @Valid @Body signupRequest: SignupRequest
    ): HttpResponse<UserResponse> {
        val user = userService.createUser(signupRequest)
        return HttpResponse.created(userService.toUserResponse(user))
    }

    @Secured("ROLE_ADMIN")
    override fun getAllUsers(): List<UserResponse> = userService.getAllUsersAsResponses()

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun getAssignableUsers(): List<UserSummaryResponse> = userService.getAssignableUsers()

    @Secured("ROLE_ADMIN")
    override fun getUserById(id: Long): UserResponse {
        val user = userService.getUserById(id)
        return userService.toUserResponse(user)
    }

    @Secured("ROLE_ADMIN")
    override fun updateUser(
        id: Long,
        @Valid @Body updateUserRequest: UpdateUserRequest
    ): UserResponse {
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
    override fun administrationChangePassword(
        id: Long,
        @Body @Valid administrationChangePasswordRequest: AdministrationChangePasswordRequest
    ) {
        userService.adminChangePassword(id, administrationChangePasswordRequest)
    }

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun getFieldConfigurationDefinitions(): List<FieldConfigurationDefinition> {
        val disabled = methodologyConfigurationService.getDisabledMethodologies()
        return fieldConfigurationService.getDefinitions(disabled)
    }

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun getFieldConfigurations(): List<FieldConfigurationEntry> = fieldConfigurationService.getAll()

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun replaceFieldConfigurations(
        @Body @Valid entries: List<FieldConfigurationEntry>
    ): List<FieldConfigurationEntry> {
        val scopes = roleService.scopesOf(getCurrentUser())
        return fieldConfigurationService.replaceScoped(entries, scopes.leadMethodologies, scopes.isAdmin)
    }

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun getMethodologyConfigurations(): List<MethodologyConfigEntry> = methodologyConfigurationService.getAll()

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun replaceMethodologyConfigurations(
        @Body @Valid methodologyConfigEntries: List<MethodologyConfigEntry>
    ): List<MethodologyConfigEntry> {
        val scopes = roleService.scopesOf(getCurrentUser())
        return methodologyConfigurationService.replaceScoped(methodologyConfigEntries, scopes.leadMethodologies, scopes.isAdmin)
    }

    @Secured(SecurityRule.IS_AUTHENTICATED)
    override fun getOrganisationSettings(): OrganisationSettingsResponse = organisationSettingsService.get()

    @Secured("ROLE_ADMIN")
    override fun updateOrganisationSettings(
        @Body organisationSettingsRequest: OrganisationSettingsRequest
    ): OrganisationSettingsResponse = organisationSettingsService.update(organisationSettingsRequest)

    private fun getCurrentUser(): User {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService
            .findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
