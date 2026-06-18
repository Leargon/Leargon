package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.OrganisationSettings
import org.leargon.backend.model.OrganisationSettingsRequest
import org.leargon.backend.model.OrganisationSettingsResponse
import org.leargon.backend.repository.OrganisationSettingsRepository

@Singleton
open class OrganisationSettingsService(
    private val organisationSettingsRepository: OrganisationSettingsRepository
) {
    @Transactional
    open fun get(): OrganisationSettingsResponse {
        val settings = organisationSettingsRepository.findFirst().orElse(OrganisationSettings())
        return toResponse(settings)
    }

    @Transactional
    open fun update(request: OrganisationSettingsRequest): OrganisationSettingsResponse {
        val settings = organisationSettingsRepository.findFirst().orElse(OrganisationSettings())
        settings.euRepresentative = request.euRepresentative
        settings.dataProtectionOfficer = request.dataProtectionOfficer
        settings.homeCountry = request.homeCountry
        val saved = organisationSettingsRepository.save(settings)
        return toResponse(saved)
    }

    private fun toResponse(settings: OrganisationSettings) =
        OrganisationSettingsResponse()
            .euRepresentative(settings.euRepresentative)
            .dataProtectionOfficer(settings.dataProtectionOfficer)
            .homeCountry(settings.homeCountry)
}
