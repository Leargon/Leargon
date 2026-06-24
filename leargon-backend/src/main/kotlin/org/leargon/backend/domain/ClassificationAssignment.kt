package org.leargon.backend.domain

// data class: generates equals/hashCode so Hibernate's dirty check on the JSON-mapped
// classification_assignments list does NOT flag the list as changed on every load (which otherwise
// makes reads flush spurious UPDATEs and deadlock under concurrency). Mirrors LocalizedText.
data class ClassificationAssignment(
    var classificationKey: String = "",
    var valueKey: String = ""
)
