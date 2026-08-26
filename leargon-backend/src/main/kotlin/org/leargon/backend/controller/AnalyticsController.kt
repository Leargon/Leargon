package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.QueryValue
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.model.TeamInsightsResponse
import org.leargon.backend.service.AnalyticsService
import org.leargon.backend.service.DefaultLocaleProvider

@Controller("/analytics")
@Secured(SecurityRule.IS_AUTHENTICATED)
open class AnalyticsController(
    private val analyticsService: AnalyticsService,
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    @Get("/team-insights")
    fun getTeamInsights(
        @QueryValue locale: String?
    ): TeamInsightsResponse = analyticsService.getTeamInsights(locale?.takeIf { it.isNotBlank() } ?: defaultLocaleProvider.code())
}
