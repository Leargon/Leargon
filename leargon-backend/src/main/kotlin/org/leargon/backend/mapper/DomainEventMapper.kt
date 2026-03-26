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
import java.time.ZoneOffset

@Singleton
open class DomainEventMapper(
    private val processMapper: ProcessMapper
) {
    fun toResponse(
        event: DomainEvent,
        processLinks: List<DomainEventProcessLink>,
        entityLinks: List<DomainEventEntityLink>
    ): DomainEventResponse {
        val publishingBc = BoundedContextMapper.toSummaryResponse(event.publishingBoundedContext)
        val consumers = event.consumers.map { BoundedContextMapper.toSummaryResponse(it)!! }
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
                BusinessEntitySummaryResponse(entity.key, entity.getName("en"))
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
