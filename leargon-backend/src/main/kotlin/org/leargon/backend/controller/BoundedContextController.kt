package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.BoundedContextApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BoundedContextMapper
import org.leargon.backend.model.BoundedContextResponse
import org.leargon.backend.model.CreateBoundedContextRequest
import org.leargon.backend.model.UpdateBoundedContextDescriptionsRequest
import org.leargon.backend.model.UpdateBoundedContextNamesRequest
import org.leargon.backend.model.UpdateBoundedContextOwningTeamRequest
import org.leargon.backend.service.BoundedContextService
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BoundedContextController(
    private val boundedContextService: BoundedContextService,
    private val boundedContextMapper: BoundedContextMapper,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService
) : BoundedContextApi {
    override fun getBoundedContextsForDomain(key: String): List<BoundedContextResponse> = boundedContextService.getForDomain(key)

    override fun getBoundedContextByKey(key: String): BoundedContextResponse = boundedContextService.getByKeyAsResponse(key)

    override fun createBoundedContext(
        key: String,
        @Valid @Body createBoundedContextRequest: CreateBoundedContextRequest
    ): HttpResponse<BoundedContextResponse> {
        val currentUser = getCurrentUser()
        roleService.requireCreateRoot(currentUser, "DDD")
        val bc = boundedContextService.create(key, createBoundedContextRequest, currentUser)
        val response = boundedContextMapper.toResponse(bc)
        return HttpResponse.status<BoundedContextResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateBoundedContextNames(
        key: String,
        @Valid @Body updateBoundedContextNamesRequest: UpdateBoundedContextNamesRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        return boundedContextService.updateNames(key, updateBoundedContextNamesRequest, currentUser)
    }

    override fun updateBoundedContextDescriptions(
        key: String,
        @Valid @Body updateBoundedContextDescriptionsRequest: UpdateBoundedContextDescriptionsRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        return boundedContextService.updateDescriptions(key, updateBoundedContextDescriptionsRequest, currentUser)
    }

    override fun updateBoundedContextOwningTeam(
        key: String,
        @Valid @Body updateBoundedContextOwningTeamRequest: UpdateBoundedContextOwningTeamRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        return boundedContextService.updateOwningTeam(key, updateBoundedContextOwningTeamRequest, currentUser)
    }

    override fun deleteBoundedContext(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        boundedContextService.delete(key, currentUser)
        return HttpResponse.noContent()
    }

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
