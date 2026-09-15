package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.BusinessDomainApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDomainMapper
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.BusinessDomainVersionResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.LocalizedBusinessDomainResponse
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SetFieldVerificationRequest
import org.leargon.backend.model.UpdateBusinessDomainParentRequest
import org.leargon.backend.model.UpdateBusinessDomainTypeRequest
import org.leargon.backend.model.UpdateDomainOwnerRequest
import org.leargon.backend.model.UpdateDomainOwningUnitRequest
import org.leargon.backend.model.UpdateDomainVisionStatementRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.BusinessDomainService
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationTarget
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BusinessDomainController(
    private val businessDomainService: BusinessDomainService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val businessDomainMapper: BusinessDomainMapper,
    private val roleService: RoleService,
    private val creationPolicyService: CreationPolicyService,
    private val creationRecordService: org.leargon.backend.service.CreationRecordService
) : BusinessDomainApi {
    override fun getAllBusinessDomains(): List<BusinessDomainResponse> = businessDomainService.getAllBusinessDomainsAsResponses()

    override fun getBusinessDomainTree(): List<BusinessDomainTreeResponse> = businessDomainService.getBusinessDomainTreeAsResponses()

    override fun getBusinessDomainByKey(key: String): BusinessDomainResponse {
        val user = getCurrentUser()
        return businessDomainService
            .getBusinessDomainByKeyAsResponse(key, user)
            .creatableChildTypes(creationPolicyService.childTypes(user, CreationPolicyService.BUSINESS_DOMAIN, key))
            .canDelete(roleService.isEditorFor(user, "DDD"))
    }

    override fun setBusinessDomainFieldVerification(
        key: String,
        @Valid @Body setFieldVerificationRequest: SetFieldVerificationRequest
    ): BusinessDomainResponse =
        businessDomainService.setFieldVerification(
            key,
            setFieldVerificationRequest.fieldName,
            setFieldVerificationRequest.status.name,
            getCurrentUser()
        )

    override fun getLocalizedBusinessDomain(
        key: String,
        locale: String?
    ): LocalizedBusinessDomainResponse {
        val currentUser = getCurrentUser()
        return businessDomainService.getLocalizedDomain(key, locale, currentUser)
    }

    override fun createBusinessDomain(
        @Valid @Body createDomainRequest: CreateBusinessDomainRequest
    ): HttpResponse<BusinessDomainResponse> {
        val currentUser = getCurrentUser()
        val decision =
            creationPolicyService.require(
                currentUser,
                CreationTarget(CreationPolicyService.BUSINESS_DOMAIN, parentKey = createDomainRequest.parentKey)
            )
        val domain = businessDomainService.createBusinessDomain(createDomainRequest, currentUser)
        creationRecordService.recordCreation(
            CreationPolicyService.BUSINESS_DOMAIN,
            domain.key,
            currentUser,
            decision.basis,
            createDomainRequest.duplicateJustification,
            createDomainRequest.acknowledgedDuplicateKeys
        )
        // Map inside a read transaction: the ownership chain walks lazy parent/owner associations.
        val response = businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
        return HttpResponse.status<BusinessDomainResponse>(HttpStatus.CREATED).body(response)
    }

    override fun deleteBusinessDomain(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        roleService.requireEditorFor(currentUser, "DDD")
        businessDomainService.deleteBusinessDomain(key)
        return HttpResponse.noContent()
    }

    override fun updateBusinessDomainParent(
        key: String,
        @Valid @Body updateBusinessDomainParentRequest: UpdateBusinessDomainParentRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "parent")
        // Moving a domain places it under the new parent (or at top level): needs creation rights there.
        creationPolicyService.require(
            currentUser,
            CreationTarget(CreationPolicyService.BUSINESS_DOMAIN, parentKey = updateBusinessDomainParentRequest.parentKey)
        )
        val domain = businessDomainService.updateBusinessDomainParent(key, updateBusinessDomainParentRequest.parentKey, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainVisionStatement(
        key: String,
        @Valid @Body updateDomainVisionStatementRequest: UpdateDomainVisionStatementRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "visionStatement")
        val domain =
            businessDomainService.updateBusinessDomainVisionStatement(
                key,
                updateDomainVisionStatementRequest.visionStatement,
                currentUser
            )
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainType(
        key: String,
        @Valid @Body updateBusinessDomainTypeRequest: UpdateBusinessDomainTypeRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "type")
        val domain = businessDomainService.updateBusinessDomainType(key, updateBusinessDomainTypeRequest.type?.value, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainNames(
        key: String,
        @Valid @Body names: List<LocalizedText>
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "names")
        val domain = businessDomainService.updateBusinessDomainNames(key, names, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainDescriptions(
        key: String,
        @Valid @Body descriptions: List<LocalizedText>
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "descriptions")
        val domain = businessDomainService.updateBusinessDomainDescriptions(key, descriptions, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainOwningUnit(
        key: String,
        @Valid @Body updateDomainOwningUnitRequest: UpdateDomainOwningUnitRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        requireDomainEdit(key, currentUser, "owningUnit")
        val domain = businessDomainService.updateOwningUnit(key, updateDomainOwningUnitRequest.owningUnitKey, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun updateBusinessDomainOwner(
        key: String,
        @Valid @Body updateDomainOwnerRequest: UpdateDomainOwnerRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        if (!businessDomainService.canAssignDomainOwner(key, currentUser) &&
            !roleService.canEditFieldByRole(currentUser, "BUSINESS_DOMAIN", "owner")
        ) {
            throw ForbiddenOperationException(
                "Assigning the domain owner requires an admin, a DDD editor/lead, or ownership of the domain or a parent domain"
            )
        }
        val domain = businessDomainService.updateOwner(key, updateDomainOwnerRequest.ownerUsername, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(domain.key, currentUser)
    }

    override fun getBusinessDomainVersions(key: String): List<BusinessDomainVersionResponse> = businessDomainService.getVersionHistory(key)

    override fun getBusinessDomainVersionDiff(
        key: String,
        versionNumber: Int
    ): VersionDiffResponse = businessDomainService.getVersionDiff(key, versionNumber)

    override fun assignClassificationsToDomain(
        key: String,
        @Valid @Body classificationAssignmentRequest: List<ClassificationAssignmentRequest>
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        classificationService.assignClassificationsToDomain(key, classificationAssignmentRequest, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(key)
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

    /**
     * Editing a domain field requires the domain owner/steward (owning-unit business owner/steward), a
     * DDD editor/lead, or an admin — the same predicate the mapper uses to compute `editableFields`, so
     * the UI affordance and the enforcement cannot drift.
     */
    private fun requireDomainEdit(
        key: String,
        currentUser: User,
        fieldName: String
    ) {
        if (!businessDomainService.canEditDomain(key, currentUser) &&
            !roleService.canEditFieldByRole(currentUser, "BUSINESS_DOMAIN", fieldName)
        ) {
            throw ForbiddenOperationException(
                "Editing this domain requires an admin, a DDD editor/lead, or the domain owner/steward"
            )
        }
    }

    companion object {
        @JvmStatic
        private fun checkAdministratorRole(user: User) {
            if (!user.roles.contains("ROLE_ADMIN")) {
                throw ForbiddenOperationException("This operation requires admin privileges")
            }
        }
    }
}
