package org.leargon.backend.exception

class AuthenticationException extends RuntimeException {
    AuthenticationException(String message) {
        super(message)
    }
}
