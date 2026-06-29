package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.ContextRelationshipApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.ContextRelationshipResponse
import org.leargon.backend.model.CreateContextRelationshipRequest
import org.leargon.backend.model.UpdateContextRelationshipRequest
import org.leargon.backend.service.ContextRelationshipService
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ContextRelationshipController(
    private val contextRelationshipService: ContextRelationshipService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService
) : ContextRelationshipApi {
    override fun getAllContextRelationships(): List<ContextRelationshipResponse> = contextRelationshipService.getAll()

    override fun createContextRelationship(
        @Body request: CreateContextRelationshipRequest
    ): HttpResponse<ContextRelationshipResponse> {
        val currentUser = getCurrentUser()
        roleService.requireCreateRoot(currentUser, "DDD")
        val response = contextRelationshipService.create(request, currentUser)
        return HttpResponse.status<ContextRelationshipResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateContextRelationship(
        id: Long,
        @Body request: UpdateContextRelationshipRequest
    ): ContextRelationshipResponse {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        return contextRelationshipService.update(id, request, currentUser)
    }

    override fun deleteContextRelationship(id: Long): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        contextRelationshipService.delete(id, currentUser)
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
