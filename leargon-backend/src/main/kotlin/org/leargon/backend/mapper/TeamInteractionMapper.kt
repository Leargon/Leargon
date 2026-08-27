package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.TeamInteraction
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.TeamInteractionDuration
import org.leargon.backend.model.TeamInteractionMode
import org.leargon.backend.model.TeamInteractionResponse
import org.leargon.backend.service.DefaultLocaleProvider

@Singleton
open class TeamInteractionMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toResponse(interaction: TeamInteraction): TeamInteractionResponse {
        val source = interaction.sourceUnit!!
        val target = interaction.targetUnit!!
        return TeamInteractionResponse(
            interaction.id!!,
            SummaryMappers.orgUnit(source, defaultLocale)!!,
            SummaryMappers.orgUnit(target, defaultLocale)!!,
            TeamInteractionMode.fromValue(interaction.mode),
            TeamInteractionDuration.fromValue(interaction.duration)
        ).healthScore(interaction.healthScore)
            .notes(interaction.notes?.let { LocalizedTextMapper.toModel(it) })
    }
}
