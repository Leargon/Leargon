package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.OrganisationSettings
import java.util.Optional

@Repository
interface OrganisationSettingsRepository : JpaRepository<OrganisationSettings, Long> {
    fun findFirst(): Optional<OrganisationSettings>
}
