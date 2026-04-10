package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ServiceProvider
import org.leargon.backend.model.LegalBasis
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.model.ServiceProviderDataFlowEntry
import org.leargon.backend.model.ServiceProviderResponse
import org.leargon.backend.model.ServiceProviderSummaryResponse
import org.leargon.backend.model.ServiceProviderType
import java.time.ZoneOffset

@Singleton
class ServiceProviderMapper {
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
            .linkedProcesses(
                sp.linkedProcesses.map {
                    ProcessSummaryResponse(it.key, it.getName("en"))
                }
            ).processDataFlows(
                sp.linkedProcesses.map { process ->
                    ServiceProviderDataFlowEntry(process.key, process.getName("en"))
                        .legalBasis(process.legalBasis?.let { LegalBasis.fromValue(it) })
                        .inputEntities(
                            BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.inputEntities),
                        ).outputEntities(
                            BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.outputEntities),
                        ).crossBorderTransfers(
                            process.crossBorderTransfers?.map {
                                CrossBorderTransferMapper.toCrossBorderTransferEntry(it)
                            },
                        ).securityMeasures(
                            process.securityMeasures?.find { it.locale == "en" }?.text
                                ?: process.securityMeasures?.firstOrNull()?.text,
                        )
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
