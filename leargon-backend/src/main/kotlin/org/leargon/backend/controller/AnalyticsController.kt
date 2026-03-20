package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.model.TeamInsightsResponse
import org.leargon.backend.service.AnalyticsService

@Controller("/analytics")
@Secured(SecurityRule.IS_AUTHENTICATED)
open class AnalyticsController(
    private val analyticsService: AnalyticsService
) {
    @Get("/team-insights")
    fun getTeamInsights(): TeamInsightsResponse = analyticsService.getTeamInsights()
}
