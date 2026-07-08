package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.TeamTopologyApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.CreateTeamInteractionRequest
import org.leargon.backend.model.TeamInteractionResponse
import org.leargon.backend.model.UpdateTeamInteractionRequest
import org.leargon.backend.service.TeamInteractionService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class TeamTopologyController(
    private val teamInteractionService: TeamInteractionService,
    private val userService: UserService,
    private val securityService: SecurityService
) : TeamTopologyApi {
    override fun getAllTeamInteractions(): List<TeamInteractionResponse> = teamInteractionService.getAllAsResponses()

    override fun getTeamInteraction(id: Long): TeamInteractionResponse = teamInteractionService.getByIdAsResponse(id)

    override fun getTeamInteractionsForUnit(key: String): List<TeamInteractionResponse> =
        teamInteractionService.getForUnitAsResponses(key)

    override fun createTeamInteraction(
        @Valid @Body request: CreateTeamInteractionRequest
    ): HttpResponse<TeamInteractionResponse> {
        val response = teamInteractionService.create(request, getCurrentUser())
        return HttpResponse.status<TeamInteractionResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateTeamInteraction(
        id: Long,
        @Valid @Body request: UpdateTeamInteractionRequest
    ): TeamInteractionResponse = teamInteractionService.update(id, request, getCurrentUser())

    override fun deleteTeamInteraction(id: Long): HttpResponse<Void> {
        teamInteractionService.delete(id, getCurrentUser())
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
