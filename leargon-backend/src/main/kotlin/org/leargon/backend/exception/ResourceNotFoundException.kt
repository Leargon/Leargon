package org.leargon.backend.exception

/**
 * Thrown when a requested resource does not exist. Maps to HTTP 404.
 *
 * [errorCode] is an optional stable identifier for *this particular* failure. The UI renders
 * `errors.<errorCode>` from its own i18n; when it is null, or the UI does not know the code, it falls
 * back to the generic code the handler derives from the HTTP status, and only then to [message].
 * [message] is an English developer-facing description and is never a display string.
 */
class ResourceNotFoundException
    @JvmOverloads
    constructor(
        message: String,
        val errorCode: String? = null
    ) : RuntimeException(message)
