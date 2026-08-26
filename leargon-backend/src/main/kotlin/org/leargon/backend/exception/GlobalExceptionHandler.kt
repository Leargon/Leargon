package org.leargon.backend.exception

import io.micronaut.context.annotation.Requires
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Produces
import io.micronaut.http.server.exceptions.ExceptionHandler
import jakarta.inject.Singleton
import org.leargon.backend.model.ErrorResponse
import org.slf4j.LoggerFactory
import java.time.ZonedDateTime

@Produces
@Singleton
@Requires(classes = [DuplicateResourceException::class, ExceptionHandler::class])
open class DuplicateResourceExceptionHandler : ExceptionHandler<DuplicateResourceException, HttpResponse<ErrorResponse>> {
    override fun handle(
        request: HttpRequest<*>,
        exception: DuplicateResourceException
    ): HttpResponse<ErrorResponse> {
        val error =
            ErrorResponse()
                .status(HttpStatus.CONFLICT.code)
                .errorCode(exception.errorCode ?: GENERIC_CONFLICT)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status<ErrorResponse>(HttpStatus.CONFLICT).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [ResourceNotFoundException::class, ExceptionHandler::class])
open class ResourceNotFoundExceptionHandler : ExceptionHandler<ResourceNotFoundException, HttpResponse<ErrorResponse>> {
    override fun handle(
        request: HttpRequest<*>,
        exception: ResourceNotFoundException
    ): HttpResponse<ErrorResponse> {
        val error =
            ErrorResponse()
                .status(HttpStatus.NOT_FOUND.code)
                .errorCode(exception.errorCode ?: GENERIC_NOT_FOUND)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status<ErrorResponse>(HttpStatus.NOT_FOUND).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [AuthenticationException::class, ExceptionHandler::class])
open class AuthenticationExceptionHandler : ExceptionHandler<AuthenticationException, HttpResponse<ErrorResponse>> {
    override fun handle(
        request: HttpRequest<*>,
        exception: AuthenticationException
    ): HttpResponse<ErrorResponse> {
        val error =
            ErrorResponse()
                .status(HttpStatus.UNAUTHORIZED.code)
                .errorCode(exception.errorCode ?: GENERIC_UNAUTHORIZED)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status<ErrorResponse>(HttpStatus.UNAUTHORIZED).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [ForbiddenOperationException::class, ExceptionHandler::class])
open class ForbiddenOperationExceptionHandler : ExceptionHandler<ForbiddenOperationException, HttpResponse<ErrorResponse>> {
    override fun handle(
        request: HttpRequest<*>,
        exception: ForbiddenOperationException
    ): HttpResponse<ErrorResponse> {
        val error =
            ErrorResponse()
                .status(HttpStatus.FORBIDDEN.code)
                .errorCode(exception.errorCode ?: GENERIC_FORBIDDEN)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status<ErrorResponse>(HttpStatus.FORBIDDEN).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [IllegalArgumentException::class, ExceptionHandler::class])
open class IllegalArgumentExceptionHandler : ExceptionHandler<IllegalArgumentException, HttpResponse<ErrorResponse>> {
    override fun handle(
        request: HttpRequest<*>,
        exception: IllegalArgumentException
    ): HttpResponse<ErrorResponse> {
        val error =
            ErrorResponse()
                .status(HttpStatus.BAD_REQUEST.code)
                .errorCode(GENERIC_BAD_REQUEST)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status<ErrorResponse>(HttpStatus.BAD_REQUEST).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [Exception::class, ExceptionHandler::class])
open class GenericExceptionHandler : ExceptionHandler<Exception, HttpResponse<*>> {
    private val log = LoggerFactory.getLogger(GenericExceptionHandler::class.java)

    override fun handle(
        request: HttpRequest<*>,
        exception: Exception
    ): HttpResponse<*> {
        log.error("Unhandled exception on {} {}: {}", request.method, request.uri, exception.message, exception)
        return HttpResponse.serverError(
            mapOf(
                "errorCode" to GENERIC_INTERNAL_ERROR,
                "message" to "An internal server error occurred"
            )
        )
    }
}

/**
 * Fallback error codes, one per HTTP status.
 *
 * An exception that names no code of its own still has to produce something the UI can localise, so the
 * handler falls back to the code for its status. That gives every error a translated message today, and
 * lets individual throw sites be refined into specific codes over time without another API change.
 */
const val GENERIC_NOT_FOUND: String = "GENERIC_NOT_FOUND"
const val GENERIC_FORBIDDEN: String = "GENERIC_FORBIDDEN"
const val GENERIC_CONFLICT: String = "GENERIC_CONFLICT"
const val GENERIC_UNAUTHORIZED: String = "GENERIC_UNAUTHORIZED"
const val GENERIC_BAD_REQUEST: String = "GENERIC_BAD_REQUEST"
const val GENERIC_INTERNAL_ERROR: String = "GENERIC_INTERNAL_ERROR"
