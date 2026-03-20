package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SearchResponse
import org.leargon.backend.model.SearchResultResponse
import org.leargon.backend.model.SearchResultResponseMatchedIn
import org.leargon.backend.model.SearchResultType
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository

@Singleton
open class SearchService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
) {
    companion object {
        private val ALL_TYPES =
            listOf(
                SearchResultType.BUSINESS_ENTITY,
                SearchResultType.BUSINESS_DOMAIN,
                SearchResultType.BUSINESS_PROCESS,
                SearchResultType.ORGANISATIONAL_UNIT,
            )
    }

    @Transactional
    open fun search(
        q: String,
        types: List<SearchResultType>?,
        limit: Int
    ): SearchResponse {
        val effectiveTypes = if (types.isNullOrEmpty()) ALL_TYPES else types
        val pattern = "%${q.lowercase()}%"
        val results = mutableListOf<SearchResultResponse>()

        if (SearchResultType.BUSINESS_ENTITY in effectiveTypes) {
            val entityRepo = businessEntityRepository
            entityRepo.searchByQuery(pattern).forEach { entity ->
                val matchedIn =
                    if (entity.names.any { it.text.contains(q, ignoreCase = true) }) {
                        SearchResultResponseMatchedIn.NAME
                    } else {
                        SearchResultResponseMatchedIn.DESCRIPTION
                    }
                results.add(
                    SearchResultResponse()
                        .type(SearchResultType.BUSINESS_ENTITY)
                        .key(entity.key)
                        .names(entity.names.map { LocalizedText(it.locale, it.text) })
                        .matchedIn(matchedIn),
                )
            }
        }

        if (SearchResultType.BUSINESS_DOMAIN in effectiveTypes) {
            val domainRepo = businessDomainRepository
            domainRepo.searchByQuery(pattern).forEach { domain ->
                val matchedIn =
                    if (domain.names.any { it.text.contains(q, ignoreCase = true) }) {
                        SearchResultResponseMatchedIn.NAME
                    } else {
                        SearchResultResponseMatchedIn.DESCRIPTION
                    }
                results.add(
                    SearchResultResponse()
                        .type(SearchResultType.BUSINESS_DOMAIN)
                        .key(domain.key)
                        .names(domain.names.map { LocalizedText(it.locale, it.text) })
                        .matchedIn(matchedIn),
                )
            }
        }

        if (SearchResultType.BUSINESS_PROCESS in effectiveTypes) {
            val procRepo = processRepository
            procRepo.searchByQuery(pattern).forEach { process ->
                val matchedIn =
                    if (process.names.any { it.text.contains(q, ignoreCase = true) }) {
                        SearchResultResponseMatchedIn.NAME
                    } else {
                        SearchResultResponseMatchedIn.DESCRIPTION
                    }
                results.add(
                    SearchResultResponse()
                        .type(SearchResultType.BUSINESS_PROCESS)
                        .key(process.key)
                        .names(process.names.map { LocalizedText(it.locale, it.text) })
                        .matchedIn(matchedIn),
                )
            }
        }

        if (SearchResultType.ORGANISATIONAL_UNIT in effectiveTypes) {
            val unitRepo = organisationalUnitRepository
            unitRepo.searchByQuery(pattern).forEach { unit ->
                val matchedIn =
                    if (unit.names.any { it.text.contains(q, ignoreCase = true) }) {
                        SearchResultResponseMatchedIn.NAME
                    } else {
                        SearchResultResponseMatchedIn.DESCRIPTION
                    }
                results.add(
                    SearchResultResponse()
                        .type(SearchResultType.ORGANISATIONAL_UNIT)
                        .key(unit.key)
                        .names(unit.names.map { LocalizedText(it.locale, it.text) })
                        .matchedIn(matchedIn),
                )
            }
        }

        // Sort: name matches first, then description; stable order within each group
        val sorted = results.sortedBy { if (it.matchedIn == SearchResultResponseMatchedIn.NAME) 0 else 1 }
        val limited = sorted.take(limit)

        return SearchResponse()
            .query(q)
            .totalCount(results.size)
            .results(limited)
    }
}
