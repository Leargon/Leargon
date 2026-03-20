package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.FieldConfiguration

@Repository
interface FieldConfigurationRepository : JpaRepository<FieldConfiguration, Long> {
    fun findByEntityType(entityType: String): List<FieldConfiguration>
}
