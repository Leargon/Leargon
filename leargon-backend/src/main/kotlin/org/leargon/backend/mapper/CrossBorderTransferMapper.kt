package org.leargon.backend.mapper

import org.leargon.backend.domain.CrossBorderTransfer
import org.leargon.backend.model.CrossBorderTransferEntry
import org.leargon.backend.model.CrossBorderTransferSafeguard

object CrossBorderTransferMapper {
    fun toCrossBorderTransferEntry(t: CrossBorderTransfer): CrossBorderTransferEntry =
        CrossBorderTransferEntry(
            t.destinationCountry,
            CrossBorderTransferSafeguard.fromValue(t.safeguard)
        ).notes(LocalizedTextMapper.toModel(t.notes))

    fun fromCrossBorderTransferEntry(e: CrossBorderTransferEntry): CrossBorderTransfer =
        CrossBorderTransfer(
            destinationCountry = e.destinationCountry,
            safeguard = e.safeguard.value,
            notes =
                e.notes?.map {
                    org.leargon.backend.domain
                        .LocalizedText(it.locale, it.text)
                } ?: emptyList()
        )
}
