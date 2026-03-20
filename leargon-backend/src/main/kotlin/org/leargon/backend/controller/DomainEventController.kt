package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.DomainEventApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.DomainEventMapper
import org.leargon.backend.model.AddDomainEventProcessLinkRequest
import org.leargon.backend.model.CreateDomainEventRequest
import org.leargon.backend.model.DomainEventResponse
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SetDomainEventConsumersRequest
import org.leargon.backend.service.DomainEventService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class DomainEventController(
    private val domainEventService: DomainEventService,
    private val domainEventMapper: DomainEventMapper,
    private val userService: UserService,
    private val securityService: SecurityService
) : DomainEventApi {
    override fun getAllDomainEvents(): List<DomainEventResponse> = domainEventService.getAll()

    override fun getDomainEventByKey(key: String): DomainEventResponse = domainEventService.getByKey(key)

    override fun createDomainEvent(
        @Valid @Body createDomainEventRequest: CreateDomainEventRequest
    ): HttpResponse<DomainEventResponse> {
        val currentUser = getCurrentUser()
        val event = domainEventService.create(createDomainEventRequest, currentUser)
        val response = domainEventService.getByKey(event.key)
        return HttpResponse.status<DomainEventResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateDomainEventNames(
        key: String,
        @Body localizedTexts: List<@Valid LocalizedText>
    ): DomainEventResponse {
        val currentUser = getCurrentUser()
        return domainEventService.updateNames(key, localizedTexts, currentUser)
    }

    override fun updateDomainEventDescriptions(
        key: String,
        @Body localizedTexts: List<@Valid LocalizedText>
    ): DomainEventResponse {
        val currentUser = getCurrentUser()
        return domainEventService.updateDescriptions(key, localizedTexts, currentUser)
    }

    @Secured("ROLE_ADMIN")
    override fun setDomainEventConsumers(
        key: String,
        @Valid @Body setDomainEventConsumersRequest: SetDomainEventConsumersRequest
    ): DomainEventResponse {
        val currentUser = getCurrentUser()
        return domainEventService.setConsumers(key, setDomainEventConsumersRequest.consumerBoundedContextKeys, currentUser)
    }

    override fun addDomainEventProcessLink(
        key: String,
        @Valid @Body addDomainEventProcessLinkRequest: AddDomainEventProcessLinkRequest
    ): DomainEventResponse {
        val currentUser = getCurrentUser()
        return domainEventService.addProcessLink(key, addDomainEventProcessLinkRequest, currentUser)
    }

    override fun removeDomainEventProcessLink(
        key: String,
        linkId: Long
    ): DomainEventResponse {
        val currentUser = getCurrentUser()
        return domainEventService.removeProcessLink(key, linkId, currentUser)
    }

    @Secured("ROLE_ADMIN")
    override fun deleteDomainEvent(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        domainEventService.delete(key, currentUser)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService
            .findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
