package org.leargon.backend.exception

/**
 * A create request did not supply fields configured as required at creation. Mapped to 422 with the
 * missing field names so the UI can point at them.
 */
class RequiredFieldsMissingException(
    val missingFields: List<String>
) : RuntimeException("Fields required at creation are missing: ${missingFields.joinToString()}")
