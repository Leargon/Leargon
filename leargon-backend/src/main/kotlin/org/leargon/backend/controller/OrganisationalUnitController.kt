package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.OrganisationalUnitApi
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.OrganisationalUnitMapper
import org.leargon.backend.model.BoundedContextSummaryResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.SetFieldVerificationRequest
import org.leargon.backend.model.UpdateLinkedServiceProvidersRequest
import org.leargon.backend.model.UpdateOrgUnitEntityLinksRequest
import org.leargon.backend.model.UpdateOrgUnitExternalFieldsRequest
import org.leargon.backend.model.UpdateOrgUnitLeadRequest
import org.leargon.backend.model.UpdateOrgUnitMissionStatementRequest
import org.leargon.backend.model.UpdateOrgUnitParentsRequest
import org.leargon.backend.model.UpdateOrgUnitStewardRequest
import org.leargon.backend.model.UpdateOrgUnitTeamTopologyTypeRequest
import org.leargon.backend.model.UpdateOrgUnitTechnicalCustodianRequest
import org.leargon.backend.model.UpdateOrgUnitTypeRequest
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationTarget
import org.leargon.backend.service.OrganisationalUnitService
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.ServiceProviderService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class OrganisationalUnitController(
    private val organisationalUnitService: OrganisationalUnitService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val organisationalUnitMapper: OrganisationalUnitMapper,
    private val serviceProviderService: ServiceProviderService,
    private val roleService: RoleService,
    private val creationPolicyService: CreationPolicyService,
    private val creationRecordService: org.leargon.backend.service.CreationRecordService
) : OrganisationalUnitApi {
    override fun getAllOrganisationalUnits(): List<OrganisationalUnitResponse> = organisationalUnitService.getAllAsResponses()

    override fun getOrganisationalUnitTree(): List<OrganisationalUnitTreeResponse> = organisationalUnitService.getTreeAsResponses()

    override fun getOrganisationalUnitByKey(key: String): OrganisationalUnitResponse {
        val user = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        return organisationalUnitService
            .getByKeyAsResponse(key)
            .creatableChildTypes(creationPolicyService.childTypes(user, CreationPolicyService.ORGANISATIONAL_UNIT, key))
            .canDelete(roleService.canDelete(user, "ORGANISATIONAL_UNIT", unit.effectiveOwner()?.id, unit.effectiveSteward()?.id))
    }

    override fun createOrganisationalUnit(
        @Valid @Body request: CreateOrganisationalUnitRequest
    ): HttpResponse<OrganisationalUnitResponse> {
        val currentUser = getCurrentUser()
        val decision =
            creationPolicyService.require(
                currentUser,
                CreationTarget(CreationPolicyService.ORGANISATIONAL_UNIT, parentKeys = request.parentKeys.orEmpty())
            )

        val unit = organisationalUnitService.create(request, currentUser)
        creationRecordService.recordCreation(
            CreationPolicyService.ORGANISATIONAL_UNIT,
            unit.key,
            currentUser,
            decision.basis,
            request.duplicateJustification,
            request.acknowledgedDuplicateKeys
        )
        val response = organisationalUnitMapper.toResponse(unit)
        return HttpResponse.status<OrganisationalUnitResponse>(HttpStatus.CREATED).body(response)
    }

    override fun deleteOrganisationalUnit(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        roleService.requireDelete(currentUser, "ORGANISATIONAL_UNIT", unit.effectiveOwner()?.id, unit.effectiveSteward()?.id)
        organisationalUnitService.delete(key)
        return HttpResponse.noContent()
    }

    override fun updateOrganisationalUnitNames(
        key: String,
        @Valid @Body names: List<LocalizedText>
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateNames(key, names, currentUser)
    }

    override fun updateOrganisationalUnitDescriptions(
        key: String,
        @Valid @Body descriptions: List<LocalizedText>
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateDescriptions(key, descriptions, currentUser)
    }

    override fun updateOrganisationalUnitMissionStatement(
        key: String,
        @Valid @Body request: UpdateOrgUnitMissionStatementRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateMissionStatement(key, request.missionStatement, currentUser)
    }

    override fun updateOrganisationalUnitTeamTopologyType(
        key: String,
        @Valid @Body request: UpdateOrgUnitTeamTopologyTypeRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateTeamTopologyType(key, request.teamTopologyType?.value, currentUser)
    }

    override fun updateOrganisationalUnitLead(
        key: String,
        @Valid @Body request: UpdateOrgUnitLeadRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateBusinessOwner(key, request.businessOwnerUsername, currentUser)
    }

    override fun updateOrganisationalUnitSteward(
        key: String,
        @Valid @Body request: UpdateOrgUnitStewardRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateBusinessSteward(key, request.businessStewardUsername, currentUser)
    }

    override fun updateOrganisationalUnitTechnicalCustodian(
        key: String,
        @Valid @Body request: UpdateOrgUnitTechnicalCustodianRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateTechnicalCustodian(key, request.technicalCustodianUsername, currentUser)
    }

    override fun updateOrganisationalUnitType(
        key: String,
        @Valid @Body request: UpdateOrgUnitTypeRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateType(key, request.unitType, currentUser)
    }

    override fun updateOrganisationalUnitParents(
        key: String,
        @Valid @Body request: UpdateOrgUnitParentsRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        creationPolicyService.requireOrgUnitParents(currentUser, key, request.keys.orEmpty())
        return organisationalUnitService.updateParents(key, request.keys, currentUser)
    }

    override fun assignClassificationsToOrgUnit(
        key: String,
        @Valid @Body classificationAssignmentRequest: List<ClassificationAssignmentRequest>
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        classificationService.assignClassificationsToOrgUnit(key, classificationAssignmentRequest, currentUser)
        return organisationalUnitService.getByKeyAsResponse(key)
    }

    override fun getOwnedBoundedContextsByOrgUnit(key: String): List<BoundedContextSummaryResponse> =
        organisationalUnitService.getOwnedBoundedContexts(key)

    override fun setOrganisationalUnitFieldVerification(
        key: String,
        @Valid @Body setFieldVerificationRequest: SetFieldVerificationRequest
    ): OrganisationalUnitResponse =
        organisationalUnitService.setFieldVerification(
            key,
            setFieldVerificationRequest.fieldName,
            setFieldVerificationRequest.status.name,
            getCurrentUser()
        )

    override fun updateOrgUnitExternalFields(
        key: String,
        @Valid @Body updateOrgUnitExternalFieldsRequest: UpdateOrgUnitExternalFieldsRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        checkEditPermission(organisationalUnitService.getByKey(key), currentUser)
        return organisationalUnitService.updateExternalFields(key, updateOrgUnitExternalFieldsRequest, currentUser)
    }

    override fun updateOrgUnitDataAccessEntities(
        key: String,
        @Valid @Body updateOrgUnitEntityLinksRequest: UpdateOrgUnitEntityLinksRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        checkEditPermission(organisationalUnitService.getByKey(key), currentUser)
        return organisationalUnitService.updateDataAccessEntities(key, updateOrgUnitEntityLinksRequest.entityKeys, currentUser)
    }

    override fun updateOrgUnitDataManipulationEntities(
        key: String,
        @Valid @Body updateOrgUnitEntityLinksRequest: UpdateOrgUnitEntityLinksRequest
    ): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        checkEditPermission(organisationalUnitService.getByKey(key), currentUser)
        return organisationalUnitService.updateDataManipulationEntities(key, updateOrgUnitEntityLinksRequest.entityKeys, currentUser)
    }

    override fun updateOrgUnitServiceProviders(
        key: String,
        @Valid @Body updateLinkedServiceProvidersRequest: UpdateLinkedServiceProvidersRequest
    ): HttpResponse<Void> {
        checkEditPermission(organisationalUnitService.getByKey(key), getCurrentUser())
        serviceProviderService.updateOrgUnitServiceProviders(key, updateLinkedServiceProvidersRequest.serviceProviderKeys)
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

    // Org units are governed by TEAM_TOPOLOGIES: editable by the business owner, effective steward, an admin,
    // or a TEAM_TOPOLOGIES editor/lead (non-owner edits land UNVERIFIED via the service's verification sync).
    private fun checkEditPermission(
        unit: OrganisationalUnit,
        currentUser: User
    ) {
        if (roleService.isEditorFor(currentUser, "TEAM_TOPOLOGIES")) return
        val isOwner = unit.effectiveOwner()?.id == currentUser.id
        val isSteward = unit.effectiveSteward()?.id == currentUser.id
        if (!isOwner && !isSteward) {
            throw ForbiddenOperationException(
                "Only the business owner, steward, a TEAM_TOPOLOGIES editor/lead, or an admin can edit this unit"
            )
        }
    }
}
