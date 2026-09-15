package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.exception.RequiredFieldsMissingException

/**
 * Enforces the "required at creation" subset of the field configuration. Presence is judged by the same
 * `presenceOf` predicate the mappers use for `missingMandatoryFields`, evaluated on the not-yet-saved
 * item, so what blocks creation and what later shows as missing can never disagree.
 */
@Singleton
open class CreationRequirementService(
    private val fieldConfigurationService: FieldConfigurationService,
    private val methodologyConfigurationService: MethodologyConfigurationService
) {
    @Transactional
    open fun requiredFields(entityType: String): List<String> =
        fieldConfigurationService.requiredAtCreation(entityType, methodologyConfigurationService.getDisabledMethodologies())

    /** Throws [RequiredFieldsMissingException] when a required-at-creation field is not present. */
    @Transactional
    open fun requireComplete(
        entityType: String,
        isPresent: (String) -> Boolean
    ) {
        val missing = requiredFields(entityType).filter { !isPresent(it) }
        if (missing.isNotEmpty()) throw RequiredFieldsMissingException(missing)
    }
}
