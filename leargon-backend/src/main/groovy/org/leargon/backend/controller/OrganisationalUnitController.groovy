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
class OrganisationalUnitController implements OrganisationalUnitApi {

    private final OrganisationalUnitService organisationalUnitService
    private final ClassificationService classificationService
    private final UserService userService
    private final SecurityService securityService
    private final OrganisationalUnitMapper organisationalUnitMapper

    OrganisationalUnitController(
            OrganisationalUnitService organisationalUnitService,
            ClassificationService classificationService,
            UserService userService,
            SecurityService securityService,
            OrganisationalUnitMapper organisationalUnitMapper
    ) {
        this.organisationalUnitService = organisationalUnitService
        this.classificationService = classificationService
        this.userService = userService
        this.securityService = securityService
        this.organisationalUnitMapper = organisationalUnitMapper
    }

    @Override
    List<OrganisationalUnitResponse> getAllOrganisationalUnits() {
        return organisationalUnitService.getAllAsResponses()
    }

    @Override
    List<OrganisationalUnitTreeResponse> getOrganisationalUnitTree() {
        return organisationalUnitService.getTreeAsResponses()
    }

    @Override
    OrganisationalUnitResponse getOrganisationalUnitByKey(String key) {
        return organisationalUnitService.getByKeyAsResponse(key)
    }

    @Override
    HttpResponse<OrganisationalUnitResponse> createOrganisationalUnit(
            @Valid @Body CreateOrganisationalUnitRequest request
    ) {
        User currentUser = getCurrentUser()
        checkCreatePermission(currentUser, request.parentKeys)

        OrganisationalUnit unit = organisationalUnitService.create(request, currentUser)
        OrganisationalUnitResponse response = organisationalUnitMapper.toResponse(unit)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    HttpResponse<Void> deleteOrganisationalUnit(String key) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)

        organisationalUnitService.delete(key)
        return HttpResponse.noContent()
    }

    @Override
    OrganisationalUnitResponse updateOrganisationalUnitNames(
            String key,
            @Valid @Body List<LocalizedText> names
    ) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateNames(key, names)
    }

    @Override
    OrganisationalUnitResponse updateOrganisationalUnitDescriptions(
            String key,
            @Valid @Body List<LocalizedText> descriptions
    ) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateDescriptions(key, descriptions)
    }

    @Override
    OrganisationalUnitResponse updateOrganisationalUnitLead(
            String key,
            @Valid @Body UpdateOrgUnitLeadRequest request
    ) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateLead(key, request.leadUsername)
    }

    @Override
    OrganisationalUnitResponse updateOrganisationalUnitType(
            String key,
            @Valid @Body UpdateOrgUnitTypeRequest request
    ) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateType(key, request.unitType)
    }

    @Override
    OrganisationalUnitResponse updateOrganisationalUnitParents(
            String key,
            @Valid @Body UpdateOrgUnitParentsRequest request
    ) {
        User currentUser = getCurrentUser()
        OrganisationalUnit unit = organisationalUnitService.getByKey(key)
        checkEditPermission(unit, currentUser)
        return organisationalUnitService.updateParents(key, request.keys)
    }

    @Override
    OrganisationalUnitResponse assignClassificationsToOrgUnit(
            String key,
            @Valid @Body List<ClassificationAssignmentRequest> classificationAssignmentRequest
    ) {
        User currentUser = getCurrentUser()
        classificationService.assignClassificationsToOrgUnit(key, classificationAssignmentRequest, currentUser)
        return organisationalUnitService.getByKeyAsResponse(key)
    }

    private User getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }

    private static void checkEditPermission(OrganisationalUnit unit, User currentUser) {
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        boolean isLead = unit.lead?.id == currentUser.id
        if (!isAdmin && !isLead) {
            throw new ForbiddenOperationException("Only the lead or an admin can edit this unit")
        }
    }

    private void checkCreatePermission(User currentUser, List<String> parentKeys) {
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        if (isAdmin) {
            return
        }

        // Non-admin can only create if parentKeys are provided and they are lead of at least one parent
        if (!parentKeys || parentKeys.isEmpty()) {
            throw new ForbiddenOperationException("Only admins can create root organisational units")
        }

        // Capture service reference for use in closure (Micronaut AOP proxy issue)
        def svc = this.organisationalUnitService
        boolean isLeadOfAnyParent = parentKeys.any { parentKey ->
            OrganisationalUnit parent = svc.getByKey(parentKey)
            return parent.lead?.id == currentUser.id
        }

        if (!isLeadOfAnyParent) {
            throw new ForbiddenOperationException("Only the lead of a parent unit or an admin can create child units")
        }
    }
}
