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
    override fun handle(request: HttpRequest<*>, exception: DuplicateResourceException): HttpResponse<ErrorResponse> {
        val error = ErrorResponse()
            .status(HttpStatus.CONFLICT.code)
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
    override fun handle(request: HttpRequest<*>, exception: ResourceNotFoundException): HttpResponse<ErrorResponse> {
        val error = ErrorResponse()
            .status(HttpStatus.NOT_FOUND.code)
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
    override fun handle(request: HttpRequest<*>, exception: AuthenticationException): HttpResponse<ErrorResponse> {
        val error = ErrorResponse()
            .status(HttpStatus.UNAUTHORIZED.code)
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
    override fun handle(request: HttpRequest<*>, exception: ForbiddenOperationException): HttpResponse<ErrorResponse> {
        val error = ErrorResponse()
            .status(HttpStatus.FORBIDDEN.code)
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
    override fun handle(request: HttpRequest<*>, exception: IllegalArgumentException): HttpResponse<ErrorResponse> {
        val error = ErrorResponse()
            .status(HttpStatus.BAD_REQUEST.code)
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

    override fun handle(request: HttpRequest<*>, exception: Exception): HttpResponse<*> {
        log.error("Unhandled exception on {} {}: {}", request.method, request.uri, exception.message, exception)
        return HttpResponse.serverError(mapOf("message" to "An internal server error occurred"))
    }
}
