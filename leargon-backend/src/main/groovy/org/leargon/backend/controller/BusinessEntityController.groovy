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
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessEntityMapper
import org.leargon.backend.model.AssignBusinessDomainRequest
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.BusinessEntityTreeResponse
import org.leargon.backend.model.BusinessEntityVersionResponse
import org.leargon.backend.model.LocalizedBusinessEntityResponse
import org.leargon.backend.model.CreateBusinessEntityRelationshipRequest
import org.leargon.backend.model.CreateBusinessEntityRequest
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
class BusinessEntityController implements BusinessEntityApi {

    private final BusinessEntityService businessEntityService
    private final ClassificationService classificationService
    private final UserService userService
    private final SecurityService securityService
    private final BusinessEntityMapper businessEntityMapper

    BusinessEntityController(
            BusinessEntityService businessEntityService,
            ClassificationService classificationService,
            UserService userService,
            SecurityService securityService,
            BusinessEntityMapper businessEntityMapper
    ) {
        this.businessEntityService = businessEntityService
        this.classificationService = classificationService
        this.userService = userService
        this.securityService = securityService
        this.businessEntityMapper = businessEntityMapper
    }

    @Override
    List<BusinessEntityResponse> getAllBusinessEntities() {
        return businessEntityService.getAllBusinessEntitiesAsResponses()
    }

    @Override
    BusinessEntityResponse getBusinessEntityByKey(String key) {
        return businessEntityService.getBusinessEntityByKeyAsResponse(key)
    }

    @Override
    List<BusinessEntityTreeResponse> getBusinessEntityTree() {
        return businessEntityService.getBusinessEntityTreeAsResponses()
    }

    @Override
    LocalizedBusinessEntityResponse getLocalizedBusinessEntity(String key, String locale) {
        User currentUser = getCurrentUser()
        return businessEntityService.getLocalizedEntity(key, locale, currentUser)
    }

    @Override
    HttpResponse<BusinessEntityResponse> createBusinessEntity(
            @Valid @Body CreateBusinessEntityRequest createBusinessEntityRequest
    ) {
        User currentUser = getCurrentUser()
        BusinessEntity entity = businessEntityService.createBusinessEntity(createBusinessEntityRequest, currentUser)
        BusinessEntityResponse response = businessEntityMapper.toBusinessEntityResponse(entity)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    HttpResponse<Void> deleteBusinessEntity(String key) {
        User currentUser = getCurrentUser()
        businessEntityService.deleteBusinessEntity(key, currentUser)
        return HttpResponse.noContent()
    }

    @Override
    List<BusinessEntityVersionResponse> getVersions(String key) {
        return businessEntityService.getVersionHistory(key)
    }

    @Override
    VersionDiffResponse getVersionDiff(String key, Integer versionNumber) {
        return businessEntityService.getVersionDiff(key, versionNumber)
    }

    @Override
    BusinessEntityResponse assignBusinessDomainToBusinessEntity(
            String key,
            @Valid @Body AssignBusinessDomainRequest assignBusinessDomainRequest
    ) {
        User currentUser = getCurrentUser()
        return businessEntityService.assignBusinessDomain(key, assignBusinessDomainRequest.businessDomainKey, currentUser)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityParent(
            String key,
            @Valid @Body UpdateBusinessEntityParentRequest updateBusinessEntityParentRequest
    ) {
        User currentUser = getCurrentUser()
        BusinessEntity entity = businessEntityService.updateBusinessEntityParent(key, updateBusinessEntityParentRequest.parentKey, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityDataOwner(
            String key,
            @Valid @Body UpdateBusinessEntityDataOwnerRequest updateBusinessEntityDataOwnerRequest
    ) {
        User currentUser = getCurrentUser()
        BusinessEntity entity = businessEntityService.updateBusinessEntityDataOwner(key, updateBusinessEntityDataOwnerRequest.dataOwnerUsername, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityNames(
            String key,
            @Valid @Body List<LocalizedText> names
    ) {
        User currentUser = getCurrentUser()
        BusinessEntity entity = businessEntityService.updateBusinessEntityNames(key, names, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityDescriptions(
            String key,
            @Valid @Body List<LocalizedText> descriptions
    ) {
        User currentUser = getCurrentUser()
        BusinessEntity entity = businessEntityService.updateBusinessEntityDescriptions(key, descriptions, currentUser)
        return businessEntityMapper.toBusinessEntityResponse(entity)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityInterfaces(
            String key,
            @Valid @Body UpdateBusinessEntityInterfacesRequest updateBusinessEntityInterfacesRequest
    ) {
        User currentUser = getCurrentUser()
        return businessEntityService.updateBusinessEntityInterfaces(key, updateBusinessEntityInterfacesRequest.interfaces, currentUser)
    }

    @Override
    HttpResponse<BusinessEntityResponse> createBusinessEntityRelationship(
            String key,
            @Valid @Body CreateBusinessEntityRelationshipRequest createBusinessEntityRelationshipRequest
    ) {
        User currentUser = getCurrentUser()
        BusinessEntityResponse response = businessEntityService.createRelationship(key, createBusinessEntityRelationshipRequest, currentUser)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    BusinessEntityResponse updateBusinessEntityRelationship(
            String key,
            Long relationshipId,
            @Valid @Body UpdateBusinessEntityRelationshipRequest updateBusinessEntityRelationshipRequest
    ) {
        User currentUser = getCurrentUser()
        return businessEntityService.updateRelationship(key, relationshipId, updateBusinessEntityRelationshipRequest, currentUser)
    }

    @Override
    HttpResponse<Void> deleteBusinessEntityRelationship(String key, Long relationshipId) {
        User currentUser = getCurrentUser()
        businessEntityService.deleteRelationship(key, relationshipId, currentUser)
        return HttpResponse.noContent()
    }

    @Override
    BusinessEntityResponse assignClassificationsToEntity(
            String key,
            @Valid @Body List<ClassificationAssignmentRequest> classificationAssignmentRequest
    ) {
        User currentUser = getCurrentUser()
        classificationService.assignClassificationsToEntity(key, classificationAssignmentRequest, currentUser)
        return businessEntityService.getBusinessEntityByKeyAsResponse(key)
    }

    private User getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }
}
