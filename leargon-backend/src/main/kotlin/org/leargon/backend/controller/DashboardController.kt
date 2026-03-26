package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.DashboardApi
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.DashboardResponse
import org.leargon.backend.model.MaturityMetricsResponse
import org.leargon.backend.service.DashboardService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class DashboardController(
    private val dashboardService: DashboardService,
    private val securityService: SecurityService,
) : DashboardApi {
    override fun getDashboard(): DashboardResponse {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return dashboardService.getDashboard(email)
    }

    @Secured("ROLE_ADMIN")
    override fun getMaturityMetrics(): MaturityMetricsResponse =
        dashboardService.getMaturityMetrics()
}
