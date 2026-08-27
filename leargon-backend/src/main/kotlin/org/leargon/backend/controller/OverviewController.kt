package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.api.OverviewApi
import org.leargon.backend.model.GroupedOverviewResponse
import org.leargon.backend.model.GroupingOptionsResponse
import org.leargon.backend.model.OverviewResourceType
import org.leargon.backend.service.OverviewGroupingService

/**
 * Read-only endpoints behind the "Group by" control on the overview pages.
 *
 * Authenticated rather than role-gated, matching the plain list endpoints these mirror: grouping
 * rearranges what a caller can already read and grants no additional access.
 */
@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class OverviewController(
    private val overviewGroupingService: OverviewGroupingService
) : OverviewApi {
    override fun getOverviewGroupings(resourceType: OverviewResourceType): GroupingOptionsResponse =
        overviewGroupingService.getGroupings(resourceType)

    override fun getGroupedOverview(
        resourceType: OverviewResourceType,
        groupBy: String
    ): GroupedOverviewResponse = overviewGroupingService.getGrouped(resourceType, groupBy)
}
