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
open class ClassificationController(
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService
) : ClassificationApi {

    override fun getClassifications(assignableTo: ClassificationAssignableTo?): List<ClassificationResponse> =
        classificationService.getClassifications(assignableTo?.value)

    override fun createClassification(@Valid @Body createClassificationRequest: CreateClassificationRequest): HttpResponse<ClassificationResponse> {
        val currentUser = getCurrentUser()
        val response = classificationService.createClassification(createClassificationRequest, currentUser)
        return HttpResponse.status<ClassificationResponse>(HttpStatus.CREATED).body(response)
    }

    override fun getClassificationByKey(key: String): ClassificationResponse =
        classificationService.getClassificationByKeyAsResponse(key)

    override fun updateClassification(key: String, @Valid @Body updateClassificationRequest: UpdateClassificationRequest): ClassificationResponse {
        val currentUser = getCurrentUser()
        return classificationService.updateClassification(key, updateClassificationRequest, currentUser)
    }

    override fun deleteClassification(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        classificationService.deleteClassification(key, currentUser)
        return HttpResponse.noContent()
    }

    override fun createClassificationValue(key: String, @Valid @Body createClassificationValueRequest: CreateClassificationValueRequest): HttpResponse<ClassificationResponse> {
        val currentUser = getCurrentUser()
        val response = classificationService.createClassificationValue(key, createClassificationValueRequest, currentUser)
        return HttpResponse.status<ClassificationResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateClassificationValue(key: String, valueKey: String, @Valid @Body updateClassificationValueRequest: UpdateClassificationValueRequest): ClassificationResponse {
        val currentUser = getCurrentUser()
        return classificationService.updateClassificationValue(key, valueKey, updateClassificationValueRequest, currentUser)
    }

    override fun deleteClassificationValue(key: String, valueKey: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        classificationService.deleteClassificationValue(key, valueKey, currentUser)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
