package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.ServiceProvider
import org.leargon.backend.domain.User
import org.leargon.backend.mapper.LocalizedTextMapper
import org.leargon.backend.model.GroupedOverviewResponse
import org.leargon.backend.model.GroupingOption
import org.leargon.backend.model.GroupingOptionsResponse
import org.leargon.backend.model.OverviewGroup
import org.leargon.backend.model.OverviewNode
import org.leargon.backend.model.OverviewResourceType
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.SupportedLocaleRepository

/**
 * Backs the "Group by" control on the overview pages.
 *
 * The lists are parent-child trees, so grouping cannot simply bucket items and forget the hierarchy:
 * an entity owned by one person often sits under a parent owned by somebody else. Each group therefore
 * keeps the sub-trees of its members, and any ancestor pulled in only to give a member its place comes
 * back with `matchesGroup = false` so the client can show it as context without offering it as a
 * member of that group.
 *
 * Which dimensions a list offers is decided here rather than in the client, so the methodology and
 * field-configuration rules live in one place: a dimension whose methodology is off, or whose backing
 * field an administrator has hidden, is never returned.
 */
@Singleton
open class OverviewGroupingService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val capabilityRepository: CapabilityRepository,
    private val itSystemRepository: ItSystemRepository,
    private val serviceProviderRepository: ServiceProviderRepository,
    private val supportedLocaleRepository: SupportedLocaleRepository,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val fieldConfigurationService: FieldConfigurationService,
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /**
     * The dimensions each resource type could offer, before methodology and field configuration have
     * their say. A type only lists what its data actually carries: a capability has no owner user and a
     * service provider has neither owner nor owning unit, so neither offers grouping by owner.
     */
    private val supportedDimensions: Map<OverviewResourceType, List<GroupingDimension>> =
        mapOf(
            OverviewResourceType.BUSINESS_ENTITY to
                listOf(
                    GroupingDimension.OWNER,
                    GroupingDimension.OWNING_UNIT,
                    GroupingDimension.BOUNDED_CONTEXT,
                    GroupingDimension.DOMAIN
                ),
            OverviewResourceType.BUSINESS_PROCESS to
                listOf(
                    GroupingDimension.OWNER,
                    GroupingDimension.OWNING_UNIT,
                    GroupingDimension.BOUNDED_CONTEXT,
                    GroupingDimension.DOMAIN,
                    GroupingDimension.PROCESS_TYPE
                ),
            OverviewResourceType.BUSINESS_DOMAIN to
                listOf(GroupingDimension.OWNER, GroupingDimension.OWNING_UNIT, GroupingDimension.DOMAIN_TYPE),
            OverviewResourceType.ORGANISATIONAL_UNIT to
                listOf(GroupingDimension.OWNER, GroupingDimension.UNIT_TYPE, GroupingDimension.TEAM_TOPOLOGY_TYPE),
            OverviewResourceType.CAPABILITY to listOf(GroupingDimension.OWNING_UNIT),
            OverviewResourceType.IT_SYSTEM to
                listOf(GroupingDimension.OWNING_UNIT, GroupingDimension.VENDOR, GroupingDimension.PROCESSING_COUNTRY),
            OverviewResourceType.SERVICE_PROVIDER to
                listOf(GroupingDimension.PROVIDER_TYPE, GroupingDimension.PROCESSING_COUNTRY)
        )

    /** The field-configuration entity type whose hidden fields govern a resource type, where one exists. */
    private val fieldConfigEntityType: Map<OverviewResourceType, String> =
        mapOf(
            OverviewResourceType.BUSINESS_ENTITY to "BUSINESS_ENTITY",
            OverviewResourceType.BUSINESS_DOMAIN to "BUSINESS_DOMAIN",
            OverviewResourceType.BUSINESS_PROCESS to "BUSINESS_PROCESS",
            OverviewResourceType.ORGANISATIONAL_UNIT to "ORGANISATIONAL_UNIT"
        )

    @Transactional(Transactional.TxType.SUPPORTS)
    open fun getGroupings(resourceType: OverviewResourceType): GroupingOptionsResponse {
        val locales = activeLocales()
        val options =
            (listOf(GroupingDimension.NONE) + availableDimensions(resourceType))
                .map { dimension ->
                    GroupingOption(dimension.name, LocalizedTextMapper.toModel(labelsFor(dimension, locales)))
                }
        return GroupingOptionsResponse(resourceType, options)
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    open fun getGrouped(
        resourceType: OverviewResourceType,
        groupBy: String
    ): GroupedOverviewResponse {
        val dimension =
            GroupingDimension.fromValueOrNull(groupBy)
                ?: throw IllegalArgumentException("Unknown grouping '$groupBy'")
        if (dimension == GroupingDimension.NONE) {
            throw IllegalArgumentException("NONE is the un-grouped tree; use the plain list endpoint")
        }
        if (dimension !in availableDimensions(resourceType)) {
            throw IllegalArgumentException("Grouping '$groupBy' does not apply to $resourceType")
        }
        val groups = adapterFor(resourceType, dimension).let { group(it) }
        return GroupedOverviewResponse(resourceType, dimension.name, groups)
    }

    // ── availability ─────────────────────────────────────────────────────────

    private fun availableDimensions(resourceType: OverviewResourceType): List<GroupingDimension> {
        val candidates =
            supportedDimensions[resourceType]
                ?: throw IllegalArgumentException("Unknown resource type $resourceType")
        val disabledMethodologies = methodologyConfigurationService.getDisabledMethodologies()
        val hidden = hiddenFieldsFor(resourceType)
        return candidates.filter { dimension ->
            val methodologyAllows = dimension.methodology == null || dimension.methodology !in disabledMethodologies
            val fieldAllows = dimension.backingField == null || dimension.backingField !in hidden
            methodologyAllows && fieldAllows
        }
    }

    /**
     * Field names an administrator has hidden for this resource type. Types with no field-configuration
     * counterpart (capability, IT system, service provider) hide nothing.
     */
    private fun hiddenFieldsFor(resourceType: OverviewResourceType): Set<String> {
        val entityType = fieldConfigEntityType[resourceType] ?: return emptySet()
        val disabled = methodologyConfigurationService.getDisabledMethodologies()
        // `isPresent` only decides which mandatory fields are *missing*; the hidden set does not depend
        // on it, so a constant is enough here.
        return fieldConfigurationService.compute(entityType, disabled) { true }.hidden?.toSet() ?: emptySet()
    }

    // ── the grouping itself ──────────────────────────────────────────────────

    private fun <T : Any> group(adapter: GroupingAdapter<T>): List<OverviewGroup> {
        val defaultLocale = defaultLocaleProvider.code()
        val buckets = LinkedHashMap<String?, MutableList<T>>()
        val valuesByGroupKey = LinkedHashMap<String?, GroupingValue>()

        adapter.items.forEach { item ->
            val value = adapter.groupOf(item)
            valuesByGroupKey.putIfAbsent(value.groupKey, value)
            buckets.getOrPut(value.groupKey) { mutableListOf() }.add(item)
        }

        return buckets
            .map { (groupKey, members) ->
                val value = valuesByGroupKey.getValue(groupKey)
                val memberKeys = members.mapTo(mutableSetOf(), adapter.keyOf)
                OverviewGroup(
                    LocalizedTextMapper.toModel(value.groupLabels),
                    members.size,
                    rootsFor(adapter, members, memberKeys, defaultLocale)
                ).key(value.groupKey)
                    .labelKey(value.groupLabelKey)
            }.sortedWith(groupOrder(defaultLocale))
    }

    /**
     * The sub-trees of one group: every member, plus the ancestors needed to reach it, each ancestor
     * flagged `matchesGroup = false` unless it is a member in its own right.
     */
    private fun <T : Any> rootsFor(
        adapter: GroupingAdapter<T>,
        members: List<T>,
        memberKeys: Set<String>,
        defaultLocale: String
    ): List<OverviewNode> {
        // Everything the group needs to draw: members and their transitive ancestors.
        val included = LinkedHashMap<String, T>()
        members.forEach { member ->
            included[adapter.keyOf(member)] = member
            collectAncestors(adapter, member, included, mutableSetOf())
        }

        val childrenByParent = LinkedHashMap<String, MutableList<T>>()
        val roots = mutableListOf<T>()
        included.values.forEach { item ->
            // An item hangs off whichever of its parents is also in the group; a unit with two such
            // parents deliberately appears under both, because its org hierarchy is a DAG.
            val parentsInGroup = adapter.parentsOf(item).filter { included.containsKey(adapter.keyOf(it)) }
            if (parentsInGroup.isEmpty()) {
                roots.add(item)
            } else {
                parentsInGroup.forEach { parent ->
                    childrenByParent.getOrPut(adapter.keyOf(parent)) { mutableListOf() }.add(item)
                }
            }
        }

        fun toNode(
            item: T,
            seen: Set<String>
        ): OverviewNode {
            val key = adapter.keyOf(item)
            // A cycle would otherwise recurse forever; the DAG makes that reachable in principle.
            val children =
                if (key in seen) {
                    emptyList()
                } else {
                    childrenByParent[key]
                        .orEmpty()
                        .map { toNode(it, seen + key) }
                        .sortedBy { it.names.textForLocaleModel(defaultLocale) }
                }
            return OverviewNode(key, LocalizedTextMapper.toModel(adapter.namesOf(item)), key in memberKeys, children)
        }

        return roots
            .map { toNode(it, emptySet()) }
            .sortedBy { it.names.textForLocaleModel(defaultLocale) }
    }

    private fun <T : Any> collectAncestors(
        adapter: GroupingAdapter<T>,
        item: T,
        into: MutableMap<String, T>,
        seen: MutableSet<String>
    ) {
        if (!seen.add(adapter.keyOf(item))) return
        adapter.parentsOf(item).forEach { parent ->
            into.putIfAbsent(adapter.keyOf(parent), parent)
            collectAncestors(adapter, parent, into, seen)
        }
    }

    /** Named groups alphabetically, with the unassigned bucket last so it never leads the list. */
    private fun groupOrder(defaultLocale: String): Comparator<OverviewGroup> =
        compareBy<OverviewGroup> { it.key == null }
            .thenBy { group ->
                group.labels.textForLocaleModel(defaultLocale).ifBlank { group.labelKey ?: group.key ?: "" }
            }

    // ── per-resource adapters ────────────────────────────────────────────────

    private fun adapterFor(
        resourceType: OverviewResourceType,
        dimension: GroupingDimension
    ): GroupingAdapter<*> =
        when (resourceType) {
            OverviewResourceType.BUSINESS_ENTITY -> {
                GroupingAdapter(
                    businessEntityRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { listOfNotNull(it.parent) },
                    { entityGroup(it, dimension) }
                )
            }

            OverviewResourceType.BUSINESS_PROCESS -> {
                GroupingAdapter(
                    processRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { listOfNotNull(it.parent) },
                    { processGroup(it, dimension) }
                )
            }

            OverviewResourceType.BUSINESS_DOMAIN -> {
                GroupingAdapter(
                    businessDomainRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { listOfNotNull(it.parent) },
                    { domainGroup(it, dimension) }
                )
            }

            OverviewResourceType.ORGANISATIONAL_UNIT -> {
                GroupingAdapter(
                    organisationalUnitRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { it.parents.toList() },
                    { unitGroup(it, dimension) }
                )
            }

            OverviewResourceType.CAPABILITY -> {
                GroupingAdapter(
                    capabilityRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { listOfNotNull(it.parent) },
                    { unitValue(it.owningUnit) }
                )
            }

            OverviewResourceType.IT_SYSTEM -> {
                GroupingAdapter(
                    itSystemRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { emptyList() },
                    { itSystemGroup(it, dimension) }
                )
            }

            OverviewResourceType.SERVICE_PROVIDER -> {
                GroupingAdapter(
                    serviceProviderRepository.findAll().toList(),
                    { it.key },
                    { it.names },
                    { emptyList() },
                    { serviceProviderGroup(it, dimension) }
                )
            }
        }

    private fun entityGroup(
        entity: BusinessEntity,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.OWNER -> userValue(entity.effectiveOwner())
            GroupingDimension.OWNING_UNIT -> unitValue(entity.effectiveOwningUnit())
            GroupingDimension.BOUNDED_CONTEXT -> contextValue(entity.boundedContext)
            GroupingDimension.DOMAIN -> domainValue(entity.boundedContext?.domain)
            else -> GroupingValue.UNASSIGNED
        }

    private fun processGroup(
        process: Process,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.OWNER -> userValue(process.effectiveOwner())
            GroupingDimension.OWNING_UNIT -> unitValue(process.effectiveOwningUnit())
            GroupingDimension.BOUNDED_CONTEXT -> contextValue(process.boundedContext)
            GroupingDimension.DOMAIN -> domainValue(process.boundedContext?.domain)
            GroupingDimension.PROCESS_TYPE -> GroupingValue.enumValue("processType", process.processType)
            else -> GroupingValue.UNASSIGNED
        }

    private fun domainGroup(
        domain: BusinessDomain,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.OWNER -> userValue(domain.effectiveOwner())
            GroupingDimension.OWNING_UNIT -> unitValue(domain.owningUnit)
            GroupingDimension.DOMAIN_TYPE -> GroupingValue.enumValue("domainType", domain.getEffectiveType())
            else -> GroupingValue.UNASSIGNED
        }

    private fun unitGroup(
        unit: OrganisationalUnit,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.OWNER -> userValue(unit.effectiveOwner())
            GroupingDimension.UNIT_TYPE -> GroupingValue.enumValue("orgUnitType", unit.unitType)
            GroupingDimension.TEAM_TOPOLOGY_TYPE -> GroupingValue.enumValue("teamTopology", unit.teamTopologyType)
            else -> GroupingValue.UNASSIGNED
        }

    private fun itSystemGroup(
        system: ItSystem,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.OWNING_UNIT -> unitValue(system.owningUnit)
            GroupingDimension.VENDOR -> GroupingValue.raw(system.vendor)
            // A system deployed in several countries groups under its first; grouping under every one
            // would list it repeatedly and overstate how many systems each country holds.
            GroupingDimension.PROCESSING_COUNTRY -> GroupingValue.raw(system.processingCountries.firstOrNull())
            else -> GroupingValue.UNASSIGNED
        }

    private fun serviceProviderGroup(
        provider: ServiceProvider,
        dimension: GroupingDimension
    ): GroupingValue =
        when (dimension) {
            GroupingDimension.PROVIDER_TYPE -> GroupingValue.enumValue("serviceProviderType", provider.serviceProviderType)
            GroupingDimension.PROCESSING_COUNTRY -> GroupingValue.raw(provider.processingCountries.firstOrNull())
            else -> GroupingValue.UNASSIGNED
        }

    private fun contextValue(context: BoundedContext?): GroupingValue =
        context?.let { GroupingValue.localized(it.key, it.names) } ?: GroupingValue.UNASSIGNED

    private fun domainValue(domain: BusinessDomain?): GroupingValue =
        domain?.let { GroupingValue.localized(it.key, it.names) } ?: GroupingValue.UNASSIGNED

    /**
     * A person groups under their username, which is stable, but reads as their full name. There is no
     * translation of a person's name, so the same text is repeated for every locale.
     */
    private fun userValue(user: User?): GroupingValue {
        if (user == null) return GroupingValue.UNASSIGNED
        val display = listOfNotNull(user.firstName, user.lastName).joinToString(" ").ifBlank { user.username }
        return GroupingValue(user.username, activeLocales().map { LocalizedText(it, display) })
    }

    private fun unitValue(unit: OrganisationalUnit?): GroupingValue =
        unit?.let { GroupingValue.localized(it.key, it.names) } ?: GroupingValue.UNASSIGNED

    // ── locales ──────────────────────────────────────────────────────────────

    private fun activeLocales(): List<String> = supportedLocaleRepository.findByIsActiveOrderBySortOrder(true).map { it.localeCode }

    private fun labelsFor(
        dimension: GroupingDimension,
        locales: List<String>
    ): List<LocalizedText> =
        locales.map { locale ->
            LocalizedText(locale, FieldLabelTranslations.translate(dimension.englishLabel, locale))
        }
}

/** Resolves an already-mapped model list, so ordering does not have to reach back to the domain type. */
private fun List<org.leargon.backend.model.LocalizedText>.textForLocaleModel(locale: String): String =
    firstOrNull { it.locale == locale && !it.text.isNullOrBlank() }?.text
        ?: firstOrNull { !it.text.isNullOrBlank() }?.text
        ?: ""
