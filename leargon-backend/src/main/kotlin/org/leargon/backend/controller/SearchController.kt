package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.api.SearchApi
import org.leargon.backend.model.SearchResponse
import org.leargon.backend.model.SearchResultType
import org.leargon.backend.service.SearchService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class SearchController(
    private val searchService: SearchService,
) : SearchApi {
    override fun search(
        q: String,
        types: List<SearchResultType>?,
        limit: Int?,
    ): SearchResponse = searchService.search(q, types, limit ?: 20)
}
