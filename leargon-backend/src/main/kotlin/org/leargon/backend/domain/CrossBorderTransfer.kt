package org.leargon.backend.domain

// data class: generates equals/hashCode so Hibernate's dirty check on the JSON-mapped
// cross_border_transfers list does NOT flag it as changed on every load (avoids spurious read-time
// UPDATEs / deadlocks). Mirrors LocalizedText / ClassificationAssignment.
data class CrossBorderTransfer(
    var destinationCountry: String = "",
    var safeguard: String = "",
    var notes: List<LocalizedText> = emptyList()
)
