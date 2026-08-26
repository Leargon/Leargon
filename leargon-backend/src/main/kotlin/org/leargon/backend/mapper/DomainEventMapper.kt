package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.DomainEvent
import org.leargon.backend.domain.DomainEventEntityLink
import org.leargon.backend.domain.DomainEventProcessLink
import org.leargon.backend.model.BusinessEntitySummaryResponse
import org.leargon.backend.model.DomainEventEntityLinkResponse
import org.leargon.backend.model.DomainEventEntityLinkType
import org.leargon.backend.model.DomainEventLinkType
import org.leargon.backend.model.DomainEventProcessLinkResponse
import org.leargon.backend.model.DomainEventResponse
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class DomainEventMapper(
    private val processMapper: ProcessMapper,
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toResponse(
        event: DomainEvent,
        processLinks: List<DomainEventProcessLink>,
        entityLinks: List<DomainEventEntityLink>
    ): DomainEventResponse {
        val publishingBc = BoundedContextMapper.toSummaryResponse(event.publishingBoundedContext, defaultLocale)
        val consumers = event.consumers.mapNotNull { BoundedContextMapper.toSummaryResponse(it, defaultLocale) }
        val mappedProcessLinks = processLinks.map { toProcessLinkResponse(it) }
        val mappedEntityLinks = entityLinks.map { toEntityLinkResponse(it) }

        val response =
            DomainEventResponse(
                event.id,
                event.key,
                LocalizedTextMapper.toModel(event.names),
                LocalizedTextMapper.toModel(event.descriptions),
                publishingBc,
                consumers,
                mappedProcessLinks,
                mappedEntityLinks,
                event.createdAt?.atZone(ZoneOffset.UTC),
                event.updatedAt?.atZone(ZoneOffset.UTC)
            )
        response.createdBy = UserMapper.toUserSummary(event.createdBy)
        return response
    }

    private fun toProcessLinkResponse(link: DomainEventProcessLink): DomainEventProcessLinkResponse {
        val processSummary = processMapper.toProcessSummaryResponse(link.process)
        return DomainEventProcessLinkResponse(
            link.id,
            processSummary,
            DomainEventLinkType.fromValue(link.linkType)
        )
    }

    private fun toEntityLinkResponse(link: DomainEventEntityLink): DomainEventEntityLinkResponse {
        val entity = link.entity
        val entitySummary =
            if (entity != null) {
                SummaryMappers.entity(entity, defaultLocale)
            } else {
                null
            }
        return DomainEventEntityLinkResponse(
            link.id,
            entitySummary,
            DomainEventEntityLinkType.fromValue(link.linkType)
        )
    }
}
