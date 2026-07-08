package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.TeamInteraction
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.TeamInteractionDuration
import org.leargon.backend.model.TeamInteractionMode
import org.leargon.backend.model.TeamInteractionResponse

@Singleton
class TeamInteractionMapper {
    fun toResponse(interaction: TeamInteraction): TeamInteractionResponse {
        val source = interaction.sourceUnit!!
        val target = interaction.targetUnit!!
        return TeamInteractionResponse(
            interaction.id!!,
            OrganisationalUnitSummaryResponse(source.key, source.getName("en")),
            OrganisationalUnitSummaryResponse(target.key, target.getName("en")),
            TeamInteractionMode.fromValue(interaction.mode),
            TeamInteractionDuration.fromValue(interaction.duration)
        ).healthScore(interaction.healthScore)
            .notes(interaction.notes?.let { LocalizedTextMapper.toModel(it) })
    }
}
