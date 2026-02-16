package org.leargon.backend.exception

import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException

/**
 * Exception thrown when attempting a forbidden operation.
 * Returns HTTP 403 Forbidden status.
 */
class ForbiddenOperationException extends HttpStatusException {

    ForbiddenOperationException(String message) {
        super(HttpStatus.FORBIDDEN, message)
    }
}
