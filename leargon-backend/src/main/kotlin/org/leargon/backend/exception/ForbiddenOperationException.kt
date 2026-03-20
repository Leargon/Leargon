package org.leargon.backend.exception

import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException

class ForbiddenOperationException(
    message: String
) : HttpStatusException(HttpStatus.FORBIDDEN, message)
