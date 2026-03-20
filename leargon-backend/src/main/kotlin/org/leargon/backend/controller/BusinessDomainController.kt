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
import org.leargon.backend.model.UpdateBusinessDomainParentRequest
import org.leargon.backend.model.UpdateBusinessDomainTypeRequest
import org.leargon.backend.model.UpdateDomainVisionStatementRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.BusinessDomainService
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BusinessDomainController(
    private val businessDomainService: BusinessDomainService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val businessDomainMapper: BusinessDomainMapper
) : BusinessDomainApi {
    override fun getAllBusinessDomains(): List<BusinessDomainResponse> = businessDomainService.getAllBusinessDomainsAsResponses()

    override fun getBusinessDomainTree(): List<BusinessDomainTreeResponse> = businessDomainService.getBusinessDomainTreeAsResponses()

    override fun getBusinessDomainByKey(key: String): BusinessDomainResponse = businessDomainService.getBusinessDomainByKeyAsResponse(key)

    override fun getLocalizedBusinessDomain(
        key: String,
        locale: String?
    ): LocalizedBusinessDomainResponse {
        val currentUser = getCurrentUser()
        return businessDomainService.getLocalizedDomain(key, locale, currentUser)
    }

    @Secured("ROLE_ADMIN")
    override fun createBusinessDomain(
        @Valid @Body createDomainRequest: CreateBusinessDomainRequest
    ): HttpResponse<BusinessDomainResponse> {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain = businessDomainService.createBusinessDomain(createDomainRequest, currentUser)
        val response = businessDomainMapper.toBusinessDomainResponse(domain)
        return HttpResponse.status<BusinessDomainResponse>(HttpStatus.CREATED).body(response)
    }

    @Secured("ROLE_ADMIN")
    override fun deleteBusinessDomain(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        businessDomainService.deleteBusinessDomain(key)
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateBusinessDomainParent(
        key: String,
        @Valid @Body updateBusinessDomainParentRequest: UpdateBusinessDomainParentRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain = businessDomainService.updateBusinessDomainParent(key, updateBusinessDomainParentRequest.parentKey, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Secured("ROLE_ADMIN")
    override fun updateBusinessDomainVisionStatement(
        key: String,
        @Valid @Body updateDomainVisionStatementRequest: UpdateDomainVisionStatementRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain =
            businessDomainService.updateBusinessDomainVisionStatement(
                key,
                updateDomainVisionStatementRequest.visionStatement,
                currentUser
            )
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Secured("ROLE_ADMIN")
    override fun updateBusinessDomainType(
        key: String,
        @Valid @Body updateBusinessDomainTypeRequest: UpdateBusinessDomainTypeRequest
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain = businessDomainService.updateBusinessDomainType(key, updateBusinessDomainTypeRequest.type?.value, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Secured("ROLE_ADMIN")
    override fun updateBusinessDomainNames(
        key: String,
        @Valid @Body names: List<LocalizedText>
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain = businessDomainService.updateBusinessDomainNames(key, names, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Secured("ROLE_ADMIN")
    override fun updateBusinessDomainDescriptions(
        key: String,
        @Valid @Body descriptions: List<LocalizedText>
    ): BusinessDomainResponse {
        val currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        val domain = businessDomainService.updateBusinessDomainDescriptions(key, descriptions, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
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

    companion object {
        @JvmStatic
        private fun checkAdministratorRole(user: User) {
            if (!user.roles.contains("ROLE_ADMIN")) {
                throw ForbiddenOperationException("This operation requires admin privileges")
            }
        }
    }
}
