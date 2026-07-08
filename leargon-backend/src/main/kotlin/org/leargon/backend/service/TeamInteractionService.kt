package org.leargon.backend.service

import io.micronaut.transaction.annotation.ReadOnly
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.TeamInteraction
import org.leargon.backend.domain.User
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.TeamInteractionMapper
import org.leargon.backend.model.CreateTeamInteractionRequest
import org.leargon.backend.model.TeamInteractionResponse
import org.leargon.backend.model.UpdateTeamInteractionRequest
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.TeamInteractionRepository

@Singleton
open class TeamInteractionService(
    private val teamInteractionRepository: TeamInteractionRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val teamInteractionMapper: TeamInteractionMapper,
    private val localeService: LocaleService,
    private val roleService: RoleService
) {
    @ReadOnly
    open fun getAllAsResponses(): List<TeamInteractionResponse> =
        teamInteractionRepository.findAll().map { teamInteractionMapper.toResponse(it) }

    @ReadOnly
    open fun getByIdAsResponse(id: Long): TeamInteractionResponse = teamInteractionMapper.toResponse(getById(id))

    @ReadOnly
    open fun getForUnitAsResponses(key: String): List<TeamInteractionResponse> {
        val unit = getUnit(key)
        return teamInteractionRepository
            .findBySourceUnitIdOrTargetUnitId(unit.id!!, unit.id!!)
            .map { teamInteractionMapper.toResponse(it) }
    }

    @Transactional
    open fun create(
        request: CreateTeamInteractionRequest,
        currentUser: User
    ): TeamInteractionResponse {
        val source = getUnit(request.sourceUnitKey)
        val target = getUnit(request.targetUnitKey)
        if (source.id == target.id) {
            throw IllegalArgumentException("An interaction must be between two different units")
        }
        if (teamInteractionRepository.existsBySourceUnitIdAndTargetUnitId(source.id!!, target.id!!)) {
            throw DuplicateResourceException("An interaction already exists between these units")
        }
        requireEdit(source, target, currentUser)
        validateHealthScore(request.healthScore)
        validateNotes(request.notes)

        val interaction = TeamInteraction()
        interaction.sourceUnit = source
        interaction.targetUnit = target
        interaction.mode = request.mode.value
        interaction.duration = request.duration.value
        interaction.healthScore = request.healthScore
        interaction.notes = request.notes?.map { LocalizedText(it.locale, it.text) }?.toMutableList()
        interaction.createdBy = currentUser
        val saved = teamInteractionRepository.save(interaction)
        return teamInteractionMapper.toResponse(getById(saved.id!!))
    }

    @Transactional
    open fun update(
        id: Long,
        request: UpdateTeamInteractionRequest,
        currentUser: User
    ): TeamInteractionResponse {
        val interaction = getById(id)
        requireEdit(interaction.sourceUnit!!, interaction.targetUnit!!, currentUser)
        validateHealthScore(request.healthScore)
        validateNotes(request.notes)

        request.mode?.let { interaction.mode = it.value }
        request.duration?.let { interaction.duration = it.value }
        interaction.healthScore = request.healthScore
        interaction.notes = request.notes?.map { LocalizedText(it.locale, it.text) }?.toMutableList()
        teamInteractionRepository.update(interaction)
        return teamInteractionMapper.toResponse(getById(id))
    }

    @Transactional
    open fun delete(
        id: Long,
        currentUser: User
    ) {
        val interaction = getById(id)
        requireEdit(interaction.sourceUnit!!, interaction.targetUnit!!, currentUser)
        teamInteractionRepository.delete(interaction)
    }

    private fun getById(id: Long): TeamInteraction =
        teamInteractionRepository.findById(id).orElseThrow { ResourceNotFoundException("Team interaction not found") }

    private fun getUnit(key: String): OrganisationalUnit =
        organisationalUnitRepository.findByKey(key).orElseThrow { ResourceNotFoundException("Organisational unit not found: $key") }

    private fun requireEdit(
        source: OrganisationalUnit,
        target: OrganisationalUnit,
        currentUser: User
    ) {
        if (roleService.isEditorFor(currentUser, "TEAM_TOPOLOGIES")) return
        val uid = currentUser.id
        val allowed =
            listOf(source, target).any { u ->
                uid != null && (uid == u.businessOwner?.id || uid == u.businessSteward?.id)
            }
        if (!allowed) {
            throw ForbiddenOperationException(
                "Editing team interactions requires an administrator, a TEAM_TOPOLOGIES editor/lead, " +
                    "or ownership/stewardship of one of the two units"
            )
        }
    }

    private fun validateHealthScore(score: Int?) {
        if (score != null && (score < 1 || score > 5)) {
            throw IllegalArgumentException("healthScore must be between 1 and 5")
        }
    }

    private fun validateNotes(notes: List<org.leargon.backend.model.LocalizedText>?) {
        notes?.forEach {
            if (!localeService.isLocaleActive(it.locale)) {
                throw IllegalArgumentException("Unsupported locale: ${it.locale}")
            }
        }
    }
}
