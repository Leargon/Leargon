package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDataQualityRuleRepository
import org.leargon.backend.repository.BusinessEntityRelationshipRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TranslationLinkRepository
import java.util.Locale

/**
 * Turns a stored field name into something a person can read, in every active locale.
 *
 * Field names are storage keys — `descriptions.en`, `classification.data-sensitivity`,
 * `relationship.42.descriptions.de` — and showing them raw in a to-do list makes the reader translate
 * from the database. This service resolves them against the field inventory
 * ([FieldConfigurationService.labelOf]) and, for the keys that point at a record, against that record's
 * own name: a classification key becomes the classification's name, a relationship id becomes the two
 * entities it joins.
 *
 * Names are resolved per locale, so a German reader sees the German classification name. Labels from
 * the static inventory ("Retention Period") exist only in English and are repeated across locales.
 */
@Singleton
open class FieldLabelService(
    private val fieldConfigurationService: FieldConfigurationService,
    private val supportedLocaleRepository: SupportedLocaleRepository,
    private val classificationRepository: ClassificationRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val businessEntityRelationshipRepository: BusinessEntityRelationshipRepository,
    private val businessDataQualityRuleRepository: BusinessDataQualityRuleRepository,
    private val translationLinkRepository: TranslationLinkRepository,
    private val capabilityRepository: CapabilityRepository,
    private val itSystemRepository: ItSystemRepository,
    private val serviceProviderRepository: ServiceProviderRepository,
    private val boundedContextRepository: BoundedContextRepository
) {
    /**
     * Per-item collection prefixes emitted by the field-value extractors, with the label each one gets.
     * The ones that resolve to a named record are handled in [itemNameOf]; the rest keep their key,
     * which is a readable slug derived from the record's name.
     */
    private val collectionPrefixes: Map<String, String> =
        mapOf(
            "relationship" to "Relationship",
            "translationLink" to "Translation Link",
            "qualityRule" to "Data Quality Rule",
            "interface" to "Interface Entity",
            "implementation" to "Implementation Entity",
            "inputEntity" to "Input Data Entity",
            "outputEntity" to "Output Data Entity",
            "dataAccess" to "Data Access",
            "dataManipulation" to "Data Manipulation",
            "executingUnit" to "Executing Unit",
            "parentUnit" to "Parent Unit",
            "capability" to "Capability",
            "itSystem" to "IT System",
            "serviceProvider" to "Service Provider",
            "boundedContext" to "Bounded Context",
            "crossBorderTransfer" to "Cross-Border Transfer"
        )

    /** Sub-fields a collection item can carry, appended to the item's own label. */
    private val subFieldLabels: Map<String, String> =
        mapOf(
            "descriptions" to "Description",
            "semanticDifferenceNote" to "Semantic Difference Note"
        )

    /**
     * Localised labels for [fieldName], or an empty list when it matches nothing known — callers then
     * fall back to the raw key rather than inventing a name.
     */
    @Transactional
    open fun labelsOf(
        entityType: String,
        fieldName: String
    ): List<LocalizedText> {
        val locales = activeLocales()
        if (locales.isEmpty()) return emptyList()

        collectionItemLabels(fieldName, locales)?.let { return it }

        if (fieldName.startsWith("classification.")) {
            val classKey = fieldName.removePrefix("classification.")
            val classification = classificationRepository.findByKey(classKey).orElse(null)
            return locales.map { locale ->
                val name = classification?.names?.forLocale(locale) ?: classKey
                LocalizedText(locale, "${translate("Classification", locale)}: $name")
            }
        }

        // Everything else comes from the static inventory, translated from its English label.
        val label = fieldConfigurationService.labelOf(entityType, fieldName) ?: return emptyList()
        return locales.map { LocalizedText(it, translateInventoryLabel(label, it)) }
    }

    /**
     * Inventory labels arrive either plain ("Legal Basis") or with the locale of a per-locale field
     * appended ("Description (en)"). Only the words are translated; the locale suffix stays as it is,
     * since it names a locale rather than describing the field.
     */
    private fun translateInventoryLabel(
        label: String,
        locale: String
    ): String = FieldLabelTranslations.translateLabel(label, locale)

    /**
     * Labels for a per-item collection field (`relationship.42`, `qualityRule.7.descriptions.de`, …),
     * or null when [fieldName] is not one.
     */
    private fun collectionItemLabels(
        fieldName: String,
        locales: List<String>
    ): List<LocalizedText>? {
        val parts = fieldName.split(".")
        if (parts.size < 2) return null
        val prefixLabel = collectionPrefixes[parts[0]] ?: return null
        val itemKey = parts[1]
        // Trailing "<subField>.<locale>" (e.g. "descriptions.de"); a bare item has neither.
        val subField = parts.getOrNull(2)
        val subLocale = parts.getOrNull(3)

        return locales.map { locale ->
            val name = itemNameOf(parts[0], itemKey, locale)
            val head = "${translate(prefixLabel, locale)}: ${name ?: itemKey}"
            val tail =
                when {
                    subField == null -> {
                        ""
                    }
                    else -> {
                        val subLabel = translate(subFieldLabels[subField] ?: subField, locale)
                        if (subLocale == null) " — $subLabel" else " — $subLabel ($subLocale)"
                    }
                }
            LocalizedText(locale, head + tail)
        }
    }

    /** The display name of the record a collection item points at, or null to keep the raw key. */
    private fun itemNameOf(
        prefix: String,
        itemKey: String,
        locale: String
    ): String? =
        when (prefix) {
            "relationship" -> {
                itemKey.toLongOrNull()?.let { id ->
                    businessEntityRelationshipRepository.findById(id).orElse(null)?.let { rel ->
                        val first = entityName(rel.firstBusinessEntity, locale)
                        val second = entityName(rel.secondBusinessEntity, locale)
                        if (first == null && second == null) null else "${first ?: "?"} ↔ ${second ?: "?"}"
                    }
                }
            }

            "translationLink" -> {
                itemKey.toLongOrNull()?.let { id ->
                    translationLinkRepository.findById(id).orElse(null)?.let { link ->
                        val first = entityName(link.firstEntity, locale)
                        val second = entityName(link.secondEntity, locale)
                        if (first == null && second == null) null else "${first ?: "?"} ↔ ${second ?: "?"}"
                    }
                }
            }

            // A quality rule has no name of its own — its description is what identifies it to a reader.
            "qualityRule" -> {
                itemKey.toLongOrNull()?.let { id ->
                    businessDataQualityRuleRepository
                        .findById(id)
                        .orElse(null)
                        ?.descriptions
                        ?.forLocale(locale)
                        ?.let { shorten(it) }
                }
            }

            "interface", "implementation", "inputEntity", "outputEntity", "dataAccess", "dataManipulation" -> {
                businessEntityRepository
                    .findByKey(itemKey)
                    .orElse(null)
                    ?.names
                    ?.forLocale(locale)
            }

            "executingUnit", "parentUnit" -> {
                organisationalUnitRepository
                    .findByKey(itemKey)
                    .orElse(null)
                    ?.names
                    ?.forLocale(locale)
            }

            "capability" -> {
                capabilityRepository
                    .findByKey(itemKey)
                    .orElse(null)
                    ?.names
                    ?.forLocale(locale)
            }

            // The only finder on this repository returns the entity itself rather than an Optional.
            "itSystem" -> {
                itSystemRepository
                    .findByKey(itemKey)
                    ?.names
                    ?.forLocale(locale)
            }

            "serviceProvider" -> {
                serviceProviderRepository
                    .findByKey(itemKey)
                    .orElse(null)
                    ?.names
                    ?.forLocale(locale)
            }

            "boundedContext" -> {
                boundedContextRepository
                    .findByKey(itemKey)
                    .orElse(null)
                    ?.names
                    ?.forLocale(locale)
            }

            // The item key *is* the country code; show the country the reader's locale knows it by.
            "crossBorderTransfer" -> {
                countryName(itemKey, locale)
            }

            else -> {
                null
            }
        }

    /** ISO 3166-1 alpha-2 code rendered in [locale] ("CH" → "Schweiz" in de), or null if unrecognised. */
    private fun countryName(
        countryCode: String,
        locale: String
    ): String? {
        if (countryCode.length != 2) return null
        val display =
            Locale
                .of("", countryCode.uppercase())
                .getDisplayCountry(Locale.forLanguageTag(locale))
        return display.takeUnless { it.isBlank() || it == countryCode.uppercase() }
    }

    private fun entityName(
        entity: BusinessEntity?,
        locale: String
    ): String? = entity?.names?.forLocale(locale) ?: entity?.key

    /** The text for [locale], falling back to the first non-blank entry so a label is never empty. */
    private fun List<LocalizedText>.forLocale(locale: String): String? =
        firstOrNull { it.locale == locale && it.text.isNotBlank() }?.text
            ?: firstOrNull { it.text.isNotBlank() }?.text

    /** Keeps a description usable as a label rather than a paragraph. */
    private fun shorten(text: String): String = if (text.length <= 60) text else text.take(57) + "…"

    private fun activeLocales(): List<String> =
        supportedLocaleRepository
            .findByIsActiveOrderBySortOrder(true)
            .map { it.localeCode }

    private fun translate(
        englishLabel: String,
        locale: String
    ): String = FieldLabelTranslations.translate(englishLabel, locale)
}
