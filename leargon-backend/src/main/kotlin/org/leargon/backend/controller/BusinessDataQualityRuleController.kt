package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.BusinessDataQualityRuleApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.BusinessDataQualityRuleResponse
import org.leargon.backend.model.CreateBusinessDataQualityRuleRequest
import org.leargon.backend.model.UpdateBusinessDataQualityRuleRequest
import org.leargon.backend.service.BusinessDataQualityRuleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class BusinessDataQualityRuleController(
    private val businessDataQualityRuleService: BusinessDataQualityRuleService,
    private val userService: UserService,
    private val securityService: SecurityService
) : BusinessDataQualityRuleApi {
    override fun getQualityRulesForEntity(key: String): List<BusinessDataQualityRuleResponse> =
        businessDataQualityRuleService.getRulesForEntity(key)

    override fun createQualityRule(
        key: String,
        @Valid @Body createBusinessDataQualityRuleRequest: CreateBusinessDataQualityRuleRequest
    ): HttpResponse<BusinessDataQualityRuleResponse> {
        val currentUser = getCurrentUser()
        val response = businessDataQualityRuleService.create(key, createBusinessDataQualityRuleRequest, currentUser)
        return HttpResponse.status<BusinessDataQualityRuleResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateQualityRule(
        key: String,
        ruleId: Long,
        @Valid @Body updateBusinessDataQualityRuleRequest: UpdateBusinessDataQualityRuleRequest
    ): BusinessDataQualityRuleResponse {
        val currentUser = getCurrentUser()
        return businessDataQualityRuleService.update(key, ruleId, updateBusinessDataQualityRuleRequest, currentUser)
    }

    override fun deleteQualityRule(
        key: String,
        ruleId: Long
    ): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        businessDataQualityRuleService.delete(key, ruleId, currentUser)
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
}
