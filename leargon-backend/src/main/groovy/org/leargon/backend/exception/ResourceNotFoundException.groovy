package org.leargon.backend.exception

class ResourceNotFoundException extends RuntimeException {
    ResourceNotFoundException(String message) {
        super(message)
    }
}
