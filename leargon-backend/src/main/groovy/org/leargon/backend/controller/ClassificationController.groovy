package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.ClassificationApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.ClassificationAssignableTo
import org.leargon.backend.model.ClassificationResponse
import org.leargon.backend.model.CreateClassificationRequest
import org.leargon.backend.model.CreateClassificationValueRequest
import org.leargon.backend.model.UpdateClassificationRequest
import org.leargon.backend.model.UpdateClassificationValueRequest
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
class ClassificationController implements ClassificationApi {

    private final ClassificationService classificationService
    private final UserService userService
    private final SecurityService securityService

    ClassificationController(
            ClassificationService classificationService,
            UserService userService,
            SecurityService securityService
    ) {
        this.classificationService = classificationService
        this.userService = userService
        this.securityService = securityService
    }

    @Override
    List<ClassificationResponse> getClassifications(ClassificationAssignableTo assignableTo) {
        return classificationService.getClassifications(assignableTo?.value)
    }

    @Override
    HttpResponse<ClassificationResponse> createClassification(
            @Valid @Body CreateClassificationRequest createClassificationRequest
    ) {
        User currentUser = getCurrentUser()
        ClassificationResponse response = classificationService.createClassification(createClassificationRequest, currentUser)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    ClassificationResponse getClassificationByKey(String key) {
        return classificationService.getClassificationByKeyAsResponse(key)
    }

    @Override
    ClassificationResponse updateClassification(
            String key,
            @Valid @Body UpdateClassificationRequest updateClassificationRequest
    ) {
        User currentUser = getCurrentUser()
        return classificationService.updateClassification(key, updateClassificationRequest, currentUser)
    }

    @Override
    HttpResponse<Void> deleteClassification(String key) {
        User currentUser = getCurrentUser()
        classificationService.deleteClassification(key, currentUser)
        return HttpResponse.noContent()
    }

    @Override
    HttpResponse<ClassificationResponse> createClassificationValue(
            String key,
            @Valid @Body CreateClassificationValueRequest createClassificationValueRequest
    ) {
        User currentUser = getCurrentUser()
        ClassificationResponse response = classificationService.createClassificationValue(key, createClassificationValueRequest, currentUser)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    ClassificationResponse updateClassificationValue(
            String key,
            String valueKey,
            @Valid @Body UpdateClassificationValueRequest updateClassificationValueRequest
    ) {
        User currentUser = getCurrentUser()
        return classificationService.updateClassificationValue(key, valueKey, updateClassificationValueRequest, currentUser)
    }

    @Override
    HttpResponse<Void> deleteClassificationValue(String key, String valueKey) {
        User currentUser = getCurrentUser()
        classificationService.deleteClassificationValue(key, valueKey, currentUser)
        return HttpResponse.noContent()
    }

    private User getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }
}
