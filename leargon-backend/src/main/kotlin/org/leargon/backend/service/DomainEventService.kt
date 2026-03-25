package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.DomainEvent
import org.leargon.backend.domain.DomainEventEntityLink
import org.leargon.backend.domain.DomainEventProcessLink
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.DomainEventMapper
import org.leargon.backend.model.AddDomainEventEntityLinkRequest
import org.leargon.backend.model.AddDomainEventProcessLinkRequest
import org.leargon.backend.model.CreateDomainEventRequest
import org.leargon.backend.model.DomainEventResponse
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.DomainEventEntityLinkRepository
import org.leargon.backend.repository.DomainEventProcessLinkRepository
import org.leargon.backend.repository.DomainEventRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class DomainEventService(
    private val domainEventRepository: DomainEventRepository,
    private val domainEventProcessLinkRepository: DomainEventProcessLinkRepository,
    private val domainEventEntityLinkRepository: DomainEventEntityLinkRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val processRepository: ProcessRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val domainEventMapper: DomainEventMapper
) {
    @Transactional
    open fun getAll(): List<DomainEventResponse> {
        val mapper = domainEventMapper
        return domainEventRepository.findAll().map { event ->
            val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
            val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
            mapper.toResponse(event, processLinks, entityLinks)
        }
    }

    @Transactional
    open fun getByKey(key: String): DomainEventResponse {
        val event = findByKey(key)
        val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(event, processLinks, entityLinks)
    }

    @Transactional
    open fun create(
        request: CreateDomainEventRequest,
        currentUser: User
    ): DomainEvent {
        val publishingBc =
            boundedContextRepository
                .findByKey(request.publishingBoundedContextKey)
                .orElseThrow { ResourceNotFoundException("BoundedContext not found: ${request.publishingBoundedContextKey}") }

        val event = DomainEvent()
        event.publishingBoundedContext = publishingBc
        event.createdBy = currentUser
        event.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        if (request.descriptions != null) {
            event.descriptions = request.descriptions!!.map { LocalizedText(it.locale, it.text) }.toMutableList()
        }

        val slug = SlugUtil.slugify(event.getName("en").ifBlank { event.names.firstOrNull()?.text ?: "event" })
        event.key = "${publishingBc.key}.$slug"

        return domainEventRepository.save(event)
    }

    @Transactional
    open fun updateNames(
        key: String,
        names: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): DomainEventResponse {
        val event = findByKey(key)
        checkEditPermission(event, currentUser)
        event.names = names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = domainEventRepository.update(event)
        val processLinks = domainEventProcessLinkRepository.findByEventId(updated.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(updated.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(updated, processLinks, entityLinks)
    }

    @Transactional
    open fun updateDescriptions(
        key: String,
        descriptions: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): DomainEventResponse {
        val event = findByKey(key)
        checkEditPermission(event, currentUser)
        event.descriptions = descriptions.map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = domainEventRepository.update(event)
        val processLinks = domainEventProcessLinkRepository.findByEventId(updated.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(updated.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(updated, processLinks, entityLinks)
    }

    @Transactional
    open fun setConsumers(
        key: String,
        consumerBoundedContextKeys: List<String>,
        currentUser: User
    ): DomainEventResponse {
        val event = findByKey(key)
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can set event consumers")
        }
        val consumers =
            consumerBoundedContextKeys.map { bcKey ->
                boundedContextRepository
                    .findByKey(bcKey)
                    .orElseThrow { ResourceNotFoundException("BoundedContext not found: $bcKey") }
            }
        event.consumers = consumers.toMutableSet()
        val updated = domainEventRepository.update(event)
        val processLinks = domainEventProcessLinkRepository.findByEventId(updated.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(updated.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(updated, processLinks, entityLinks)
    }

    @Transactional
    open fun addProcessLink(
        key: String,
        request: AddDomainEventProcessLinkRequest,
        currentUser: User
    ): DomainEventResponse {
        val event = findByKey(key)
        val process =
            processRepository
                .findByKey(request.processKey)
                .orElseThrow { ResourceNotFoundException("Process not found: ${request.processKey}") }

        val link = DomainEventProcessLink()
        link.event = event
        link.process = process
        link.linkType = request.linkType.value
        domainEventProcessLinkRepository.save(link)

        val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(event, processLinks, entityLinks)
    }

    @Transactional
    open fun removeProcessLink(
        key: String,
        linkId: Long,
        currentUser: User
    ): DomainEventResponse {
        val event = findByKey(key)
        val link =
            domainEventProcessLinkRepository
                .findById(linkId)
                .orElseThrow { ResourceNotFoundException("ProcessLink not found: $linkId") }
        domainEventProcessLinkRepository.delete(link)

        val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(event, processLinks, entityLinks)
    }

    @Transactional
    open fun addEntityLink(
        key: String,
        request: AddDomainEventEntityLinkRequest,
        currentUser: User
    ): DomainEventResponse {
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can add entity links to domain events")
        }
        val event = findByKey(key)
        val entity =
            businessEntityRepository
                .findByKey(request.entityKey)
                .orElseThrow { ResourceNotFoundException("BusinessEntity not found: ${request.entityKey}") }

        val link = DomainEventEntityLink()
        link.event = event
        link.entity = entity
        link.linkType = request.linkType.value
        domainEventEntityLinkRepository.save(link)

        val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(event, processLinks, entityLinks)
    }

    @Transactional
    open fun removeEntityLink(
        key: String,
        linkId: Long,
        currentUser: User
    ): DomainEventResponse {
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can remove entity links from domain events")
        }
        val event = findByKey(key)
        val link =
            domainEventEntityLinkRepository
                .findById(linkId)
                .orElseThrow { ResourceNotFoundException("EntityLink not found: $linkId") }
        domainEventEntityLinkRepository.delete(link)

        val processLinks = domainEventProcessLinkRepository.findByEventId(event.id!!)
        val entityLinks = domainEventEntityLinkRepository.findByEventId(event.id!!)
        val mapper = domainEventMapper
        return mapper.toResponse(event, processLinks, entityLinks)
    }

    @Transactional
    open fun delete(
        key: String,
        currentUser: User
    ) {
        val event = findByKey(key)
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can delete domain events")
        }
        domainEventEntityLinkRepository.deleteByEventId(event.id!!)
        domainEventProcessLinkRepository.deleteByEventId(event.id!!)
        domainEventRepository.delete(event)
    }

    private fun findByKey(key: String): DomainEvent =
        domainEventRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("DomainEvent not found: $key") }

    @Suppress("UNUSED_PARAMETER")
    private fun checkEditPermission(
        event: DomainEvent,
        currentUser: User
    ) {
        // Allow any authenticated user to update names/descriptions
    }
}
