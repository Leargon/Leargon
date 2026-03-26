package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import jakarta.validation.Valid
import org.leargon.backend.api.CapabilityApi
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateCapabilityRequest
import org.leargon.backend.model.UpdateCapabilityProcessLinksRequest
import org.leargon.backend.model.UpdateCapabilityRequest
import org.leargon.backend.service.CapabilityService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class CapabilityController(
    private val capabilityService: CapabilityService
) : CapabilityApi {
    override fun getAllCapabilities(): List<CapabilityResponse> = capabilityService.getAll()

    override fun getCapabilityByKey(key: String): CapabilityResponse = capabilityService.getByKey(key)

    @Secured("ROLE_ADMIN")
    override fun createCapability(
        @Valid @Body createCapabilityRequest: CreateCapabilityRequest
    ): HttpResponse<CapabilityResponse> {
        val response = capabilityService.create(createCapabilityRequest)
        return HttpResponse.status<CapabilityResponse>(HttpStatus.CREATED).body(response)
    }

    @Secured("ROLE_ADMIN")
    override fun updateCapability(
        key: String,
        @Valid @Body updateCapabilityRequest: UpdateCapabilityRequest
    ): CapabilityResponse = capabilityService.update(key, updateCapabilityRequest)

    @Secured("ROLE_ADMIN")
    override fun deleteCapability(key: String): HttpResponse<Void> {
        capabilityService.delete(key)
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateCapabilityLinkedProcesses(
        key: String,
        @Valid @Body updateCapabilityProcessLinksRequest: UpdateCapabilityProcessLinksRequest
    ): HttpResponse<Void> {
        capabilityService.updateLinkedProcesses(
            key,
            updateCapabilityProcessLinksRequest.processKeys ?: emptyList()
        )
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun assignClassificationsToCapability(
        key: String,
        @Body classificationAssignmentRequests: List<@Valid ClassificationAssignmentRequest>
    ): HttpResponse<Void> {
        capabilityService.assignClassifications(key, classificationAssignmentRequests)
        return HttpResponse.noContent()
    }
}
