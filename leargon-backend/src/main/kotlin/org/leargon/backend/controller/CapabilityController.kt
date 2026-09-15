package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.CapabilityApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateCapabilityRequest
import org.leargon.backend.model.UpdateCapabilityProcessLinksRequest
import org.leargon.backend.model.UpdateCapabilityRequest
import org.leargon.backend.service.CapabilityService
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationTarget
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class CapabilityController(
    private val capabilityService: CapabilityService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService,
    private val creationPolicyService: CreationPolicyService,
    private val creationRecordService: org.leargon.backend.service.CreationRecordService
) : CapabilityApi {
    override fun getAllCapabilities(): List<CapabilityResponse> = capabilityService.getAll()

    override fun getCapabilityByKey(key: String): CapabilityResponse {
        val user = getCurrentUser()
        return capabilityService
            .getByKey(key)
            .canEdit(roleService.isEditorFor(user, "BCM"))
            .creatableChildTypes(creationPolicyService.childTypes(user, CreationPolicyService.CAPABILITY, key))
    }

    override fun createCapability(
        @Valid @Body createCapabilityRequest: CreateCapabilityRequest
    ): HttpResponse<CapabilityResponse> {
        val currentUser = getCurrentUser()
        val decision =
            creationPolicyService.require(
                currentUser,
                CreationTarget(CreationPolicyService.CAPABILITY, parentKey = createCapabilityRequest.parentCapabilityKey)
            )
        val response = capabilityService.create(createCapabilityRequest)
        creationRecordService.recordCreation(
            CreationPolicyService.CAPABILITY,
            response.key,
            currentUser,
            decision.basis,
            createCapabilityRequest.duplicateJustification,
            createCapabilityRequest.acknowledgedDuplicateKeys
        )
        return HttpResponse.status<CapabilityResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateCapability(
        key: String,
        @Valid @Body updateCapabilityRequest: UpdateCapabilityRequest
    ): CapabilityResponse {
        roleService.requireEditorFor(getCurrentUser(), "BCM")
        return capabilityService.update(key, updateCapabilityRequest)
    }

    override fun deleteCapability(key: String): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "BCM")
        capabilityService.delete(key)
        return HttpResponse.noContent()
    }

    override fun updateCapabilityLinkedProcesses(
        key: String,
        @Valid @Body updateCapabilityProcessLinksRequest: UpdateCapabilityProcessLinksRequest
    ): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "BCM")
        capabilityService.updateLinkedProcesses(
            key,
            updateCapabilityProcessLinksRequest.processKeys ?: emptyList()
        )
        return HttpResponse.noContent()
    }

    override fun assignClassificationsToCapability(
        key: String,
        @Body classificationAssignmentRequests: List<@Valid ClassificationAssignmentRequest>
    ): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "BCM")
        capabilityService.assignClassifications(key, classificationAssignmentRequests)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email = securityService.username().orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email).orElseThrow { ResourceNotFoundException("User not found") }
    }
}
