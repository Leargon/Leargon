package org.leargon.backend.exception

import io.micronaut.context.annotation.Requires
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Produces
import io.micronaut.http.server.exceptions.ExceptionHandler
import jakarta.inject.Singleton
import org.leargon.backend.model.ErrorResponse

import java.time.ZonedDateTime

@Produces
@Singleton
@Requires(classes = [DuplicateResourceException.class, ExceptionHandler.class])
class DuplicateResourceExceptionHandler implements ExceptionHandler<DuplicateResourceException, HttpResponse<ErrorResponse>> {

    @Override
    HttpResponse<ErrorResponse> handle(HttpRequest request, DuplicateResourceException exception) {
        ErrorResponse error = new ErrorResponse()
                .status(HttpStatus.CONFLICT.code)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status(HttpStatus.CONFLICT).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [ResourceNotFoundException.class, ExceptionHandler.class])
class ResourceNotFoundExceptionHandler implements ExceptionHandler<ResourceNotFoundException, HttpResponse<ErrorResponse>> {

    @Override
    HttpResponse<ErrorResponse> handle(HttpRequest request, ResourceNotFoundException exception) {
        ErrorResponse error = new ErrorResponse()
                .status(HttpStatus.NOT_FOUND.code)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status(HttpStatus.NOT_FOUND).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [AuthenticationException.class, ExceptionHandler.class])
class AuthenticationExceptionHandler implements ExceptionHandler<AuthenticationException, HttpResponse<ErrorResponse>> {

    @Override
    HttpResponse<ErrorResponse> handle(HttpRequest request, AuthenticationException exception) {
        ErrorResponse error = new ErrorResponse()
                .status(HttpStatus.UNAUTHORIZED.code)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status(HttpStatus.UNAUTHORIZED).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [ForbiddenOperationException.class, ExceptionHandler.class])
class ForbiddenOperationExceptionHandler implements ExceptionHandler<ForbiddenOperationException, HttpResponse<ErrorResponse>> {

    @Override
    HttpResponse<ErrorResponse> handle(HttpRequest request, ForbiddenOperationException exception) {
        ErrorResponse error = new ErrorResponse()
                .status(HttpStatus.FORBIDDEN.code)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status(HttpStatus.FORBIDDEN).body(error)
    }
}

@Produces
@Singleton
@Requires(classes = [IllegalArgumentException.class, ExceptionHandler.class])
class IllegalArgumentExceptionHandler implements ExceptionHandler<IllegalArgumentException, HttpResponse<ErrorResponse>> {

    @Override
    HttpResponse<ErrorResponse> handle(HttpRequest request, IllegalArgumentException exception) {
        ErrorResponse error = new ErrorResponse()
                .status(HttpStatus.BAD_REQUEST.code)
                .message(exception.message)
                .path(request.path)
                .timestamp(ZonedDateTime.now())
        return HttpResponse.status(HttpStatus.BAD_REQUEST).body(error)
    }
}
