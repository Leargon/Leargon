package org.leargon.backend.mapper

import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.Capability
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.model.BoundedContextSummaryResponse
import org.leargon.backend.model.BusinessDomainSummaryResponse
import org.leargon.backend.model.BusinessEntitySummaryResponse
import org.leargon.backend.model.CapabilitySummaryResponse
import org.leargon.backend.model.ItSystemSummaryResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse

/**
 * Builds the `*SummaryResponse` DTOs that every detail response embeds for its neighbours — the owning
 * unit of an entity, the parent of a process, the bounded context of a domain, and so on.
 *
 * These used to be constructed inline in a dozen mappers with a hardcoded `getName("en")`, which is why
 * a German tenant read "Logistics" instead of "Logistik" wherever a neighbour was referenced. Each
 * summary now carries the full `names` list so the client can render the reader's locale, and the plain
 * `name` field stays on as the tenant-default-locale fallback for anything that does not read the list.
 *
 * [defaultLocale] is the tenant default from [org.leargon.backend.service.DefaultLocaleProvider], never a
 * literal.
 */
object SummaryMappers {
    fun orgUnit(
        unit: OrganisationalUnit?,
        defaultLocale: String
    ): OrganisationalUnitSummaryResponse? {
        if (unit == null) return null
        return OrganisationalUnitSummaryResponse(unit.key, unit.getName(defaultLocale))
            .names(LocalizedTextMapper.toModel(unit.names))
            .isExternal(unit.isExternal)
    }

    fun orgUnits(
        units: Collection<OrganisationalUnit>?,
        defaultLocale: String
    ): List<OrganisationalUnitSummaryResponse> = units.orEmpty().mapNotNull { orgUnit(it, defaultLocale) }

    fun process(
        process: Process?,
        defaultLocale: String
    ): ProcessSummaryResponse? {
        if (process == null) return null
        return ProcessSummaryResponse(process.key, process.getName(defaultLocale))
            .names(LocalizedTextMapper.toModel(process.names))
            .description(process.descriptions.takeIf { it.isNotEmpty() }?.let { process.getDescription(defaultLocale) })
            .descriptions(LocalizedTextMapper.toModel(process.descriptions))
    }

    fun processes(
        processes: Collection<Process>?,
        defaultLocale: String
    ): List<ProcessSummaryResponse> = processes.orEmpty().mapNotNull { process(it, defaultLocale) }

    fun entity(
        entity: BusinessEntity?,
        defaultLocale: String
    ): BusinessEntitySummaryResponse? {
        if (entity == null) return null
        return BusinessEntitySummaryResponse(entity.key, entity.getName(defaultLocale))
            .names(LocalizedTextMapper.toModel(entity.names))
    }

    fun entities(
        entities: Collection<BusinessEntity>?,
        defaultLocale: String
    ): List<BusinessEntitySummaryResponse> = entities.orEmpty().mapNotNull { entity(it, defaultLocale) }

    fun domain(
        domain: BusinessDomain?,
        defaultLocale: String
    ): BusinessDomainSummaryResponse? {
        if (domain == null) return null
        return BusinessDomainSummaryResponse(domain.key, domain.getName(defaultLocale))
            .names(LocalizedTextMapper.toModel(domain.names))
    }

    fun boundedContext(
        bc: BoundedContext?,
        defaultLocale: String
    ): BoundedContextSummaryResponse? {
        if (bc == null) return null
        val domain = bc.domain
        return BoundedContextSummaryResponse(
            bc.key,
            bc.getName(defaultLocale),
            domain?.key ?: "",
            domain?.getName(defaultLocale) ?: ""
        ).names(LocalizedTextMapper.toModel(bc.names))
            .domainNames(LocalizedTextMapper.toModel(domain?.names.orEmpty()))
            .owningUnitName(bc.owningUnit?.getName(defaultLocale))
            .owningUnitNames(LocalizedTextMapper.toModel(bc.owningUnit?.names.orEmpty()))
    }

    fun itSystem(
        system: ItSystem?,
        defaultLocale: String
    ): ItSystemSummaryResponse? {
        if (system == null) return null
        return ItSystemSummaryResponse(system.key, system.getName(defaultLocale), system.processingCountries)
            .names(LocalizedTextMapper.toModel(system.names))
    }

    fun capability(
        capability: Capability?,
        defaultLocale: String
    ): CapabilitySummaryResponse? {
        if (capability == null) return null
        return CapabilitySummaryResponse(capability.key, capability.getName(defaultLocale))
            .names(LocalizedTextMapper.toModel(capability.names))
    }
}
