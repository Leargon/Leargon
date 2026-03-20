package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.model.FieldConfigurationEntry
import org.leargon.backend.repository.FieldConfigurationRepository

@Singleton
open class FieldConfigurationService(
    private val fieldConfigurationRepository: FieldConfigurationRepository
) {
    @Transactional
    open fun getAll(): List<FieldConfigurationEntry> = fieldConfigurationRepository.findAll().map { toEntry(it) }

    @Transactional
    open fun replace(entries: List<FieldConfigurationEntry>): List<FieldConfigurationEntry> {
        fieldConfigurationRepository.deleteAll()
        val saved =
            entries.map { entry ->
                val config = FieldConfiguration()
                config.entityType = entry.entityType
                config.fieldName = entry.fieldName
                fieldConfigurationRepository.save(config)
            }
        return saved.map { toEntry(it) }
    }

    data class FieldConfigResult(
        val mandatory: List<String>?,
        val missing: List<String>?
    )

    fun compute(
        entityType: String,
        isPresent: (String) -> Boolean
    ): FieldConfigResult {
        val configs = fieldConfigurationRepository.findByEntityType(entityType)
        if (configs.isEmpty()) return FieldConfigResult(null, null)
        val names = configs.map { it.fieldName }
        val missing = names.filter { !isPresent(it) }
        return FieldConfigResult(names, missing.ifEmpty { null })
    }

    private fun toEntry(config: FieldConfiguration): FieldConfigurationEntry = FieldConfigurationEntry(config.entityType, config.fieldName)
}
