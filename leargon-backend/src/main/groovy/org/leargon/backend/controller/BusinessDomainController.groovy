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
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDomainMapper
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainVersionResponse
import org.leargon.backend.model.LocalizedBusinessDomainResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.UpdateBusinessDomainParentRequest
import org.leargon.backend.model.UpdateBusinessDomainTypeRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.BusinessDomainService
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
class BusinessDomainController implements BusinessDomainApi {

    private final BusinessDomainService businessDomainService
    private final ClassificationService classificationService
    private final UserService userService
    private final SecurityService securityService
    private final BusinessDomainMapper businessDomainMapper

    BusinessDomainController(
            BusinessDomainService businessDomainService,
            ClassificationService classificationService,
            UserService userService,
            SecurityService securityService,
            BusinessDomainMapper businessDomainMapper
    ) {
        this.businessDomainService = businessDomainService
        this.classificationService = classificationService
        this.userService = userService
        this.securityService = securityService
        this.businessDomainMapper = businessDomainMapper
    }

    @Override
    List<BusinessDomainResponse> getAllBusinessDomains() {
        return businessDomainService.getAllBusinessDomainsAsResponses()
    }

    @Override
    List<BusinessDomainTreeResponse> getBusinessDomainTree() {
        return businessDomainService.getBusinessDomainTreeAsResponses()
    }

    @Override
    BusinessDomainResponse getBusinessDomainByKey(String key) {
        return businessDomainService.getBusinessDomainByKeyAsResponse(key)
    }

    @Override
    LocalizedBusinessDomainResponse getLocalizedBusinessDomain(String key, String locale) {
        User currentUser = getCurrentUser()
        return businessDomainService.getLocalizedDomain(key, locale, currentUser)
    }

    @Override
    @Secured("ROLE_ADMIN")
    HttpResponse<BusinessDomainResponse> createBusinessDomain(
            @Valid @Body CreateBusinessDomainRequest createDomainRequest
    ) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)

        BusinessDomain domain = businessDomainService.createBusinessDomain(createDomainRequest, currentUser)
        BusinessDomainResponse response = businessDomainMapper.toBusinessDomainResponse(domain)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    @Secured("ROLE_ADMIN")
    HttpResponse<Void> deleteBusinessDomain(String key) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)

        businessDomainService.deleteBusinessDomain(key, currentUser)
        return HttpResponse.noContent()
    }

    @Override
    @Secured("ROLE_ADMIN")
    BusinessDomainResponse updateBusinessDomainParent(
            String key,
            @Valid @Body UpdateBusinessDomainParentRequest updateBusinessDomainParentRequest
    ) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        BusinessDomain domain = businessDomainService.updateBusinessDomainParent(key, updateBusinessDomainParentRequest.parentKey, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Override
    @Secured("ROLE_ADMIN")
    BusinessDomainResponse updateBusinessDomainType(
            String key,
            @Valid @Body UpdateBusinessDomainTypeRequest updateBusinessDomainTypeRequest
    ) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        BusinessDomain domain = businessDomainService.updateBusinessDomainType(key, updateBusinessDomainTypeRequest.type?.value, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Override
    @Secured("ROLE_ADMIN")
    BusinessDomainResponse updateBusinessDomainNames(
            String key,
            @Valid @Body List<LocalizedText> names
    ) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        BusinessDomain domain = businessDomainService.updateBusinessDomainNames(key, names, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Override
    @Secured("ROLE_ADMIN")
    BusinessDomainResponse updateBusinessDomainDescriptions(
            String key,
            @Valid @Body List<LocalizedText> descriptions
    ) {
        User currentUser = getCurrentUser()
        checkAdministratorRole(currentUser)
        BusinessDomain domain = businessDomainService.updateBusinessDomainDescriptions(key, descriptions, currentUser)
        return businessDomainMapper.toBusinessDomainResponse(domain)
    }

    @Override
    List<BusinessDomainVersionResponse> getBusinessDomainVersions(String key) {
        return businessDomainService.getVersionHistory(key)
    }

    @Override
    VersionDiffResponse getBusinessDomainVersionDiff(String key, Integer versionNumber) {
        return businessDomainService.getVersionDiff(key, versionNumber)
    }

    @Override
    BusinessDomainResponse assignClassificationsToDomain(
            String key,
            @Valid @Body List<ClassificationAssignmentRequest> classificationAssignmentRequest
    ) {
        User currentUser = getCurrentUser()
        classificationService.assignClassificationsToDomain(key, classificationAssignmentRequest, currentUser)
        return businessDomainService.getBusinessDomainByKeyAsResponse(key)
    }

    private User getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }

    private static void checkAdministratorRole(User user) {
        if (!user.roles?.contains("ROLE_ADMIN")) {
            throw new ForbiddenOperationException("This operation requires admin privileges")
        }
    }
}
