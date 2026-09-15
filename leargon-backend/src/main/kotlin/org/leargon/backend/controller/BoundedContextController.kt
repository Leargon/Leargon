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
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BoundedContextMapper
import org.leargon.backend.model.BoundedContextResponse
import org.leargon.backend.model.CreateBoundedContextRequest
import org.leargon.backend.model.UpdateBoundedContextDescriptionsRequest
import org.leargon.backend.model.UpdateBoundedContextNamesRequest
import org.leargon.backend.model.UpdateBoundedContextOwnerRequest
import org.leargon.backend.model.UpdateBoundedContextOwningTeamRequest
import org.leargon.backend.service.BoundedContextService
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationTarget
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BoundedContextController(
    private val boundedContextService: BoundedContextService,
    private val boundedContextMapper: BoundedContextMapper,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService,
    private val creationPolicyService: CreationPolicyService,
    private val creationRecordService: org.leargon.backend.service.CreationRecordService
) : BoundedContextApi {
    override fun getBoundedContextsForDomain(key: String): List<BoundedContextResponse> {
        val user = getCurrentUser()
        return boundedContextService.getForDomain(key).map { withUserFlags(it, user) }
    }

    override fun getBoundedContextByKey(key: String): BoundedContextResponse =
        withUserFlags(boundedContextService.getByKeyAsResponse(key), getCurrentUser())

    /** Attaches the backend-computed per-user edit and creation flags. */
    private fun withUserFlags(
        response: BoundedContextResponse,
        user: User
    ): BoundedContextResponse {
        val dddEditor = roleService.isEditorFor(user, "DDD")
        return response
            .editableFields(boundedContextService.editableFields(response.key, user, dddEditor))
            .creatableChildTypes(creationPolicyService.childTypes(user, CreationPolicyService.BOUNDED_CONTEXT, response.key))
    }

    /** Editing a bounded context: a DDD editor/lead, an admin, or the context's effective owner. */
    private fun requireBcEdit(
        key: String,
        user: User
    ) {
        if (!roleService.isEditorFor(user, "DDD") && !boundedContextService.canEdit(key, user)) {
            throw ForbiddenOperationException("Editing this bounded context requires an admin, a DDD editor/lead, or its owner")
        }
    }

    override fun createBoundedContext(
        key: String,
        @Valid @Body createBoundedContextRequest: CreateBoundedContextRequest
    ): HttpResponse<BoundedContextResponse> {
        val currentUser = getCurrentUser()
        val decision = creationPolicyService.require(currentUser, CreationTarget(CreationPolicyService.BOUNDED_CONTEXT, domainKey = key))
        val bc = boundedContextService.create(key, createBoundedContextRequest, currentUser)
        creationRecordService.recordCreation(
            CreationPolicyService.BOUNDED_CONTEXT,
            bc.key,
            currentUser,
            decision.basis,
            createBoundedContextRequest.duplicateJustification,
            createBoundedContextRequest.acknowledgedDuplicateKeys
        )
        // Map inside a transaction: the ownership chain walks lazy owner/domain associations.
        val response = boundedContextService.getByKeyAsResponse(bc.key)
        return HttpResponse.status<BoundedContextResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateBoundedContextNames(
        key: String,
        @Valid @Body updateBoundedContextNamesRequest: UpdateBoundedContextNamesRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        requireBcEdit(key, currentUser)
        return boundedContextService.updateNames(key, updateBoundedContextNamesRequest, currentUser)
    }

    override fun updateBoundedContextDescriptions(
        key: String,
        @Valid @Body updateBoundedContextDescriptionsRequest: UpdateBoundedContextDescriptionsRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        requireBcEdit(key, currentUser)
        return boundedContextService.updateDescriptions(key, updateBoundedContextDescriptionsRequest, currentUser)
    }

    override fun updateBoundedContextOwningTeam(
        key: String,
        @Valid @Body updateBoundedContextOwningTeamRequest: UpdateBoundedContextOwningTeamRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        requireBcEdit(key, currentUser)
        return boundedContextService.updateOwningTeam(key, updateBoundedContextOwningTeamRequest, currentUser)
    }

    override fun updateBoundedContextOwner(
        key: String,
        @Valid @Body updateBoundedContextOwnerRequest: UpdateBoundedContextOwnerRequest
    ): BoundedContextResponse {
        val currentUser = getCurrentUser()
        if (!boundedContextService.canAssignOwner(key, currentUser) && !roleService.isEditorFor(currentUser, "DDD")) {
            throw ForbiddenOperationException(
                "Assigning the bounded context owner requires an admin, a DDD editor/lead, or ownership of the context or its domain"
            )
        }
        return boundedContextService.updateOwner(key, updateBoundedContextOwnerRequest.ownerUsername, currentUser)
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
