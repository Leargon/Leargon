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

    /** Stable signature of a localized-text list (sorted "locale=text"), for change detection. */
    fun localizedSignature(list: List<LocalizedText>?): String =
        list.orEmpty().sortedBy { it.locale }.joinToString(",") { "${it.locale}=${it.text}" }

    /**
     * Per-locale verification entries for a localized field inside a collection item:
     * `"<prefix>.<locale>" -> text` for each non-blank locale. Emitting one entry per locale (instead of a
     * single folded [localizedSignature]) gives each locale its own status row — so verifying one language
     * survives edits to another, exactly like the top-level per-locale fields (`names.en`, `names.de`).
     */
    fun localizedItems(
        prefix: String,
        list: List<LocalizedText>?
    ): Map<String, String> =
        list
            .orEmpty()
            .filter { it.text.isNotBlank() }
            .associate { "$prefix.${it.locale}" to it.text }

    /** Pipe-joins parts into a stable item signature (nulls become empty). */
    fun signature(vararg parts: Any?): String = parts.joinToString("|") { it?.toString() ?: "" }

    /**
     * Builds a per-item collection map: "<prefix>.<key>" -> signature. The key must be a stable,
     * URL-safe-ish identifier (entity key, db id, …). Items with a blank key are skipped.
     */
    fun <I> items(
        prefix: String,
        elements: Collection<I>?,
        keyOf: (I) -> String?,
        signatureOf: (I) -> String
    ): Map<String, String> =
        elements
            .orEmpty()
            .mapNotNull { e -> keyOf(e)?.takeUnless { it.isBlank() }?.let { "$prefix.$it" to signatureOf(e) } }
            .toMap()
}

/** Marker for an extractor of a single governance entity type. */
interface FieldValueExtractor<T> {
    val entityType: String

    /**
     * Normalized value of a *global* (scalar/localized/classification) [fieldName] for [entity], or null
     * when absent/blank or a collection field (those are handled by [collectionItemValues]). Throws for
     * unknown field names so the coverage test fails loudly when a new inventory field is not wired here.
     */
    fun value(
        entity: T,
        fieldName: String
    ): String?

    /**
     * Per-item collection fields for [entity]: "<prefix>.<itemKey>" -> signature. Each item gets its own
     * verification status, so adding/removing/editing one item only affects that item.
     */
    fun collectionItemValues(entity: T): Map<String, String> = emptyMap()
}
