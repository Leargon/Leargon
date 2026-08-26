package org.leargon.backend.service

import org.leargon.backend.domain.LocalizedText

/**
 * The dimensions an overview list can be grouped by.
 *
 * [englishLabel] is the key into [FieldLabelTranslations], so a dimension is named the same way here
 * as the field it groups on is named on a detail panel and in the to-do list.
 *
 * [methodology] is the methodology that must be enabled for the dimension to be offered, and
 * [backingField] the field-configuration field name an administrator can hide to withdraw it. Both
 * null means the dimension is always available — grouping by owner is core and cannot be switched off.
 */
enum class GroupingDimension(
    val englishLabel: String,
    val methodology: String? = null,
    val backingField: String? = null
) {
    /** The plain parent-child tree — no grouping. Always offered, always first. */
    NONE("Hierarchy"),
    OWNER("Owner"),
    OWNING_UNIT("Owning Unit", backingField = "owningUnit"),
    BOUNDED_CONTEXT("Bounded Context", methodology = "DDD", backingField = "boundedContext"),
    DOMAIN("Domain", methodology = "DDD", backingField = "boundedContext"),
    PROCESS_TYPE("Process Type"),
    DOMAIN_TYPE("Domain Type"),
    UNIT_TYPE("Unit Type"),
    TEAM_TOPOLOGY_TYPE("Team Topology Type", methodology = "TEAM_TOPOLOGIES", backingField = "teamTopologyType"),
    VENDOR("Vendor"),
    PROCESSING_COUNTRY("Processing Country"),
    PROVIDER_TYPE("Service Provider Type")
    ;

    companion object {
        fun fromValueOrNull(value: String): GroupingDimension? = entries.firstOrNull { it.name == value }
    }
}

/**
 * One item's place in a grouped list, before it is turned into an API response.
 *
 * [groupKey] is null when the item has no value for the dimension, which puts it in the unassigned
 * bucket. [groupLabels] carries the value's own translations when the value is user content (a unit
 * name); [groupLabelKey] names an i18n key instead when the value is a closed enum the UI already
 * translates. Exactly one of the two is meaningful for any given dimension.
 */
data class GroupingValue(
    val groupKey: String?,
    val groupLabels: List<LocalizedText> = emptyList(),
    val groupLabelKey: String? = null
) {
    companion object {
        /** The unassigned bucket: no value for this dimension. */
        val UNASSIGNED = GroupingValue(null, emptyList(), "common.unassigned")

        /** A value that is user content, and so already has its own translations. */
        fun localized(
            key: String,
            names: List<LocalizedText>
        ) = GroupingValue(key, names)

        /** A closed enum value the frontend already translates under [namespace]. */
        fun enumValue(
            namespace: String,
            value: String?
        ): GroupingValue = if (value == null) UNASSIGNED else GroupingValue(value, emptyList(), "$namespace.$value")

        /** A plain string with no translations of its own — a vendor name, a country code. */
        fun raw(value: String?): GroupingValue = if (value.isNullOrBlank()) UNASSIGNED else GroupingValue(value, emptyList())
    }
}

/**
 * What the grouping algorithm needs to know about one resource type: the items, how to walk up to an
 * item's parents, its name, and which group it falls into.
 *
 * Parents is a list rather than a single value because an organisational unit can have several — that
 * hierarchy is a DAG, not a tree — and such a unit legitimately appears under each of its ancestor
 * paths inside a group.
 */
class GroupingAdapter<T : Any>(
    val items: List<T>,
    val keyOf: (T) -> String,
    val namesOf: (T) -> List<LocalizedText>,
    val parentsOf: (T) -> List<T>,
    val groupOf: (T) -> GroupingValue
)
