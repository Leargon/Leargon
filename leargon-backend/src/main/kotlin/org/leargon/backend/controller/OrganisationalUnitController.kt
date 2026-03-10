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
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateOrganisationalUnitRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.UpdateOrgUnitLeadRequest
import org.leargon.backend.model.UpdateOrgUnitParentsRequest
import org.leargon.backend.model.UpdateOrgUnitTypeRequest
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.OrganisationalUnitService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class OrganisationalUnitController(
    private val organisationalUnitService: OrganisationalUnitService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val organisationalUnitMapper: OrganisationalUnitMapper
) : OrganisationalUnitApi {

    override fun getAllOrganisationalUnits(): List<OrganisationalUnitResponse> =
        organisationalUnitService.getAllAsResponses()

    override fun getOrganisationalUnitTree(): List<OrganisationalUnitTreeResponse> =
        organisationalUnitService.getTreeAsResponses()

    override fun getOrganisationalUnitByKey(key: String): OrganisationalUnitResponse =
        organisationalUnitService.getByKeyAsResponse(key)

    override fun createOrganisationalUnit(@Valid @Body request: CreateOrganisationalUnitRequest): HttpResponse<OrganisationalUnitResponse> {
        val currentUser = getCurrentUser()
        checkCreatePermission(currentUser, request.parentKeys)

        val unit = organisationalUnitService.create(request, currentUser)
        val response = organisationalUnitMapper.toResponse(unit)
        return HttpResponse.status<OrganisationalUnitResponse>(HttpStatus.CREATED).body(response)
    }

    override fun deleteOrganisationalUnit(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        organisationalUnitService.delete(key)
        return HttpResponse.noContent()
    }

    override fun updateOrganisationalUnitNames(key: String, @Valid @Body names: List<LocalizedText>): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateNames(key, names)
    }

    override fun updateOrganisationalUnitDescriptions(key: String, @Valid @Body descriptions: List<LocalizedText>): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateDescriptions(key, descriptions)
    }

    override fun updateOrganisationalUnitLead(key: String, @Valid @Body request: UpdateOrgUnitLeadRequest): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateLead(key, request.leadUsername)
    }

    override fun updateOrganisationalUnitType(key: String, @Valid @Body request: UpdateOrgUnitTypeRequest): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateType(key, request.unitType)
    }

    override fun updateOrganisationalUnitParents(key: String, @Valid @Body request: UpdateOrgUnitParentsRequest): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        val unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateParents(key, request.keys)
    }

    override fun assignClassificationsToOrgUnit(key: String, @Valid @Body classificationAssignmentRequest: List<ClassificationAssignmentRequest>): OrganisationalUnitResponse {
        val currentUser = getCurrentUser()
        classificationService.assignClassificationsToOrgUnit(key, classificationAssignmentRequest, currentUser)
        return organisationalUnitService.getByKeyAsResponse(key)
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }

    private fun checkCreatePermission(currentUser: User, parentKeys: List<String>?) {
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        if (isAdmin) return

        if (parentKeys.isNullOrEmpty()) {
            throw ForbiddenOperationException("Only admins can create root organisational units")
        }

        val isLeadOfAnyParent = parentKeys.any { parentKey ->
            val parent = organisationalUnitService.getByKey(parentKey)
            parent.lead?.id == currentUser.id
        }

        if (!isLeadOfAnyParent) {
            throw ForbiddenOperationException("Only the lead of a parent unit or an admin can create child units")
        }
    }

    companion object {
        @JvmStatic
        private fun checkEditPermission(unit: OrganisationalUnit, currentUser: User) {
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            val isLead = unit.lead?.id == currentUser.id
            if (!isAdmin && !isLead) {
                throw ForbiddenOperationException("Only the lead or an admin can edit this unit")
            }
        }
    }
}
