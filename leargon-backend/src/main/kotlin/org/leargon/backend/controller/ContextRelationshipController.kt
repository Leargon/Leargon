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
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ContextRelationshipController(
    private val contextRelationshipService: ContextRelationshipService,
    private val userService: UserService,
    private val securityService: SecurityService
) : ContextRelationshipApi {

    override fun getAllContextRelationships(): List<ContextRelationshipResponse> =
        contextRelationshipService.getAll()

    @Secured("ROLE_ADMIN")
    override fun createContextRelationship(@Body request: CreateContextRelationshipRequest): HttpResponse<ContextRelationshipResponse> {
        val currentUser = getCurrentUser()
        val response = contextRelationshipService.create(request, currentUser)
        return HttpResponse.status<ContextRelationshipResponse>(HttpStatus.CREATED).body(response)
    }

    @Secured("ROLE_ADMIN")
    override fun updateContextRelationship(id: Long, @Body request: UpdateContextRelationshipRequest): ContextRelationshipResponse =
        contextRelationshipService.update(id, request)

    @Secured("ROLE_ADMIN")
    override fun deleteContextRelationship(id: Long): HttpResponse<Void> {
        contextRelationshipService.delete(id)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
