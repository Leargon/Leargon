package org.leargon.backend.service.fieldvalue

import org.leargon.backend.domain.ClassificationAssignment
import org.leargon.backend.domain.LocalizedText

/**
 * Shared helpers for the per-entity [FieldValueExtractor]s. A field's value is normalized to a
 * stable [String] (or null when absent/blank) so that [FieldVerificationService] can detect changes
 * by simple string comparison.
 *
 * Collection / relationship fields are intentionally NOT status-tracked (they return null); see each
 * extractor for the explicit list. Scalar, localized, single-reference and classification fields are
 * tracked.
 */
object FieldValueSupport {
    /** Value of a localized field for the locale encoded in `prefix.<locale>` (e.g. names.en). */
    fun localized(
        list: List<LocalizedText>?,
        prefix: String,
        fieldName: String
    ): String? {
        val locale = fieldName.removePrefix("$prefix.")
        val text = list?.firstOrNull { it.locale == locale }?.text
        return text?.takeUnless { it.isBlank() }
    }

    /** Sorted, comma-joined value keys assigned for the classification encoded in `classification.<key>`. */
    fun classification(
        assignments: List<ClassificationAssignment>,
        fieldName: String
    ): String? {
        val classKey = fieldName.removePrefix("classification.")
        val values = assignments.filter { it.classificationKey == classKey }.map { it.valueKey }.sorted()
        return values.joinToString(",").ifEmpty { null }
    }

    fun blankToNull(value: String?): String? = value?.takeUnless { it.isBlank() }

    fun keysOf(keys: Collection<String>?): String? = keys?.sorted()?.joinToString(",")?.ifEmpty { null }
}

/** Marker for an extractor of a single governance entity type. */
interface FieldValueExtractor<T> {
    val entityType: String

    /**
     * Normalized value of [fieldName] for [entity], or null when the field is absent/blank or is a
     * collection field that is deliberately not status-tracked. Throws for unknown field names so the
     * coverage test fails loudly when a new inventory field is not wired here.
     */
    fun value(
        entity: T,
        fieldName: String
    ): String?
}
