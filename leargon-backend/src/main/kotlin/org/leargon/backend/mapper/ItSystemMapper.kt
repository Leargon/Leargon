package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.ItSystemSummaryResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class ItSystemMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider,
    private val serviceProviderMapper: ServiceProviderMapper
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toItSystemSummaryResponse(itSystem: ItSystem): ItSystemSummaryResponse = SummaryMappers.itSystem(itSystem, defaultLocale)!!

    fun toItSystemResponse(itSystem: ItSystem): ItSystemResponse {
        val spMapper = serviceProviderMapper
        return ItSystemResponse(
            itSystem.key,
            LocalizedTextMapper.toModel(itSystem.names),
            LocalizedTextMapper.toModel(itSystem.descriptions),
            itSystem.createdAt.atZone(ZoneOffset.UTC),
            itSystem.updatedAt?.atZone(ZoneOffset.UTC)
        ).vendor(itSystem.vendor)
            .systemUrl(itSystem.systemUrl)
            .processingCountries(itSystem.processingCountries)
            .serviceProviders(itSystem.serviceProviders.map { spMapper.toServiceProviderSummaryResponse(it) })
            .owningUnit(SummaryMappers.orgUnit(itSystem.owningUnit, defaultLocale))
            .linkedProcesses(SummaryMappers.processes(itSystem.linkedProcesses, defaultLocale))
    }
}
