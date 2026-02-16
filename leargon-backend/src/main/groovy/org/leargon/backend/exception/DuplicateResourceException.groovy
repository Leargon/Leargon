package org.leargon.backend.exception

class DuplicateResourceException extends RuntimeException {
    DuplicateResourceException(String message) {
        super(message)
    }
}
