package org.leargon.backend.mapper

import jakarta.inject.Inject
import jakarta.inject.Singleton
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.model.BoundedContextResponse
import org.leargon.backend.model.BoundedContextResponseContextType
import org.leargon.backend.model.BoundedContextSummaryResponse
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class BoundedContextMapper {
    @Inject
    lateinit var organisationalUnitMapper: OrganisationalUnitMapper

    @Inject
    lateinit var defaultLocaleProvider: DefaultLocaleProvider

    fun toResponse(bc: BoundedContext): BoundedContextResponse {
        val domainSummary = BusinessDomainMapper.toBusinessDomainSummary(bc.domain, defaultLocaleProvider.code())
        val response =
            BoundedContextResponse(
                bc.key,
                LocalizedTextMapper.toModel(bc.names),
                domainSummary,
                bc.createdAt?.atZone(ZoneOffset.UTC),
                bc.updatedAt?.atZone(ZoneOffset.UTC)
            )
        response.descriptions = LocalizedTextMapper.toModel(bc.descriptions)
        response.createdBy = UserMapper.toUserSummary(bc.createdBy)
        response.owningTeam = organisationalUnitMapper.toSummaryResponse(bc.owningUnit)
        if (bc.contextType != null) {
            response.contextType = BoundedContextResponseContextType.fromValue(bc.contextType!!)
        }
        return response
    }

    companion object {
        @JvmStatic
        fun toSummaryResponse(
            bc: BoundedContext?,
            defaultLocale: String
        ): BoundedContextSummaryResponse? = SummaryMappers.boundedContext(bc, defaultLocale)

        @JvmStatic
        fun toSummaryResponseList(
            boundedContexts: Collection<BoundedContext>,
            defaultLocale: String
        ): List<BoundedContextSummaryResponse> = boundedContexts.mapNotNull { toSummaryResponse(it, defaultLocale) }
    }
}
