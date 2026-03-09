package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.BusinessEntityApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.AssignBusinessDomainRequest
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.BusinessEntityTreeResponse
import org.leargon.backend.model.BusinessEntityVersionResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateBusinessEntityRelationshipRequest
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.LocalizedBusinessEntityResponse
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.UpdateBusinessEntityDataOwnerRequest
import org.leargon.backend.model.UpdateBusinessEntityInterfacesRequest
import org.leargon.backend.model.UpdateBusinessEntityParentRequest
import org.leargon.backend.model.UpdateBusinessEntityRelationshipRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.BusinessEntityService
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BusinessEntityController(
    private val businessEntityService: BusinessEntityService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService
) : BusinessEntityApi {

    override fun getAllBusinessEntities(): List<BusinessEntityResponse> =
        businessEntityService.getAllBusinessEntitiesAsResponses()

    override fun getBusinessEntityByKey(key: String): BusinessEntityResponse =
        businessEntityService.getBusinessEntityByKeyAsResponse(key)

    override fun getBusinessEntityTree(): List<BusinessEntityTreeResponse> =
        businessEntityService.getBusinessEntityTreeAsResponses()

    override fun getLocalizedBusinessEntity(key: String, locale: String?): LocalizedBusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.getLocalizedEntity(key, locale, currentUser)
    }

    override fun createBusinessEntity(@Valid @Body createBusinessEntityRequest: CreateBusinessEntityRequest): HttpResponse<BusinessEntityResponse> {
        val currentUser = getCurrentUser()
        val response = businessEntityService.createBusinessEntityAsResponse(createBusinessEntityRequest, currentUser)
        return HttpResponse.status<BusinessEntityResponse>(HttpStatus.CREATED).body(response)
    }

    override fun deleteBusinessEntity(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        businessEntityService.deleteBusinessEntity(key, currentUser)
        return HttpResponse.noContent()
    }

    override fun getVersions(key: String): List<BusinessEntityVersionResponse> =
        businessEntityService.getVersionHistory(key)

    override fun getVersionDiff(key: String, versionNumber: Int): VersionDiffResponse =
        businessEntityService.getVersionDiff(key, versionNumber)

    override fun assignBusinessDomainToBusinessEntity(key: String, @Valid @Body assignBusinessDomainRequest: AssignBusinessDomainRequest): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.assignBusinessDomain(key, assignBusinessDomainRequest.businessDomainKey, currentUser)
    }

    override fun updateBusinessEntityParent(key: String, @Valid @Body updateBusinessEntityParentRequest: UpdateBusinessEntityParentRequest): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityParentAsResponse(key, updateBusinessEntityParentRequest.parentKey, currentUser)
    }

    override fun updateBusinessEntityDataOwner(key: String, @Valid @Body updateBusinessEntityDataOwnerRequest: UpdateBusinessEntityDataOwnerRequest): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityDataOwnerAsResponse(key, updateBusinessEntityDataOwnerRequest.dataOwnerUsername, currentUser)
    }

    override fun updateBusinessEntityNames(key: String, @Valid @Body names: List<LocalizedText>): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityNamesAsResponse(key, names, currentUser)
    }

    override fun updateBusinessEntityDescriptions(key: String, @Valid @Body descriptions: List<LocalizedText>): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityDescriptionsAsResponse(key, descriptions, currentUser)
    }

    override fun updateBusinessEntityInterfaces(key: String, @Valid @Body updateBusinessEntityInterfacesRequest: UpdateBusinessEntityInterfacesRequest): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityInterfaces(key, updateBusinessEntityInterfacesRequest.interfaces, currentUser)
    }

    override fun createBusinessEntityRelationship(key: String, @Valid @Body createBusinessEntityRelationshipRequest: CreateBusinessEntityRelationshipRequest): HttpResponse<BusinessEntityResponse> {
        val currentUser = getCurrentUser()
        val response = businessEntityService.createRelationship(key, createBusinessEntityRelationshipRequest, currentUser)
        return HttpResponse.status<BusinessEntityResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateBusinessEntityRelationship(key: String, relationshipId: Long, @Valid @Body updateBusinessEntityRelationshipRequest: UpdateBusinessEntityRelationshipRequest): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        return businessEntityService.updateRelationship(key, relationshipId, updateBusinessEntityRelationshipRequest, currentUser)
    }

    override fun deleteBusinessEntityRelationship(key: String, relationshipId: Long): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        businessEntityService.deleteRelationship(key, relationshipId, currentUser)
        return HttpResponse.noContent()
    }

    override fun assignClassificationsToEntity(key: String, @Valid @Body classificationAssignmentRequest: List<ClassificationAssignmentRequest>): BusinessEntityResponse {
        val currentUser = getCurrentUser()
        classificationService.assignClassificationsToEntity(key, classificationAssignmentRequest, currentUser)
        return businessEntityService.getBusinessEntityByKeyAsResponse(key)
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
