package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.CrossBorderTransfer
import org.leargon.backend.domain.DataProcessor
import org.leargon.backend.model.BusinessEntitySummaryResponse
import org.leargon.backend.model.CrossBorderTransferEntry
import org.leargon.backend.model.CrossBorderTransferSafeguard
import org.leargon.backend.model.DataProcessorResponse
import org.leargon.backend.model.DataProcessorSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse
import java.time.ZoneOffset

@Singleton
class DataProcessorMapper {
    fun toDataProcessorResponse(dp: DataProcessor): DataProcessorResponse =
        DataProcessorResponse(
            dp.key,
            LocalizedTextMapper.toModel(dp.names),
            dp.processingCountries,
            dp.processorAgreementInPlace,
            dp.subProcessorsApproved,
            dp.createdAt.atZone(ZoneOffset.UTC)
        ).updatedAt(dp.updatedAt?.atZone(ZoneOffset.UTC))
            .linkedBusinessEntities(
                dp.linkedBusinessEntities.map {
                    BusinessEntitySummaryResponse(it.key, it.getName("en"))
                }
            ).linkedProcesses(
                dp.linkedProcesses.map {
                    ProcessSummaryResponse(it.key, it.getName("en"))
                }
            )

    fun toDataProcessorSummaryResponse(dp: DataProcessor): DataProcessorSummaryResponse =
        DataProcessorSummaryResponse(
            dp.key,
            LocalizedTextMapper.toModel(dp.names),
            dp.processorAgreementInPlace,
            dp.subProcessorsApproved
        )

    companion object {
        @JvmStatic
        fun toCrossBorderTransferEntry(t: CrossBorderTransfer): CrossBorderTransferEntry =
            CrossBorderTransferEntry(
                t.destinationCountry,
                CrossBorderTransferSafeguard.fromValue(t.safeguard)
            ).notes(t.notes)

        @JvmStatic
        fun fromCrossBorderTransferEntry(e: CrossBorderTransferEntry): CrossBorderTransfer =
            CrossBorderTransfer(
                destinationCountry = e.destinationCountry,
                safeguard = e.safeguard.value,
                notes = e.notes
            )
    }
}
