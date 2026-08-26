package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ServiceProvider
import org.leargon.backend.domain.textForLocale
import org.leargon.backend.model.LegalBasis
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.model.ServiceProviderDataFlowEntry
import org.leargon.backend.model.ServiceProviderResponse
import org.leargon.backend.model.ServiceProviderSummaryResponse
import org.leargon.backend.model.ServiceProviderType
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class ServiceProviderMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toServiceProviderResponse(sp: ServiceProvider): ServiceProviderResponse =
        ServiceProviderResponse(
            sp.key,
            LocalizedTextMapper.toModel(sp.names),
            ServiceProviderType.fromValue(sp.serviceProviderType),
            sp.processingCountries,
            sp.processorAgreementInPlace,
            sp.subProcessorsApproved,
            sp.createdAt.atZone(ZoneOffset.UTC)
        ).updatedAt(sp.updatedAt?.atZone(ZoneOffset.UTC))
            .linkedProcesses(SummaryMappers.processes(sp.linkedProcesses, defaultLocale))
            .processDataFlows(
                sp.linkedProcesses.map { process ->
                    ServiceProviderDataFlowEntry(process.key, process.getName(defaultLocale))
                        .processNames(LocalizedTextMapper.toModel(process.names))
                        .legalBasis(process.legalBasis?.let { LegalBasis.fromValue(it) })
                        .inputEntities(
                            BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.inputEntities, defaultLocale),
                        ).outputEntities(
                            BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.outputEntities, defaultLocale),
                        ).crossBorderTransfers(
                            process.crossBorderTransfers?.map {
                                CrossBorderTransferMapper.toCrossBorderTransferEntry(it)
                            },
                        ).securityMeasures(
                            process.securityMeasures?.takeIf { it.isNotEmpty() }?.textForLocale(defaultLocale, ""),
                        ).securityMeasuresLocalized(LocalizedTextMapper.toModel(process.securityMeasures))
                },
            )

    fun toServiceProviderSummaryResponse(sp: ServiceProvider): ServiceProviderSummaryResponse =
        ServiceProviderSummaryResponse(
            sp.key,
            LocalizedTextMapper.toModel(sp.names),
            ServiceProviderType.fromValue(sp.serviceProviderType),
            sp.processorAgreementInPlace,
            sp.subProcessorsApproved
        )
}
