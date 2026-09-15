package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.AdvisorApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.AdvisorEvaluateRequest
import org.leargon.backend.model.AdvisorEvaluateResponse
import org.leargon.backend.model.AdvisorRuleSet
import org.leargon.backend.service.UserService
import org.leargon.backend.service.advisor.AdvisorService

/** The guided modelling advisor: "Not sure where this belongs?" */
@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class AdvisorController(
    private val advisorService: AdvisorService,
    private val userService: UserService,
    private val securityService: SecurityService
) : AdvisorApi {
    override fun getAdvisorRuleSets(): List<AdvisorRuleSet> = advisorService.ruleSets()

    override fun evaluateAdvisor(advisorEvaluateRequest: AdvisorEvaluateRequest): AdvisorEvaluateResponse =
        advisorService.evaluate(getCurrentUser(), advisorEvaluateRequest)

    private fun getCurrentUser(): User {
        val email = securityService.username().orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email).orElseThrow { ResourceNotFoundException("User not found") }
    }
}
