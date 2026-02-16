package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.SetupApi
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.UserResponse
import org.leargon.backend.service.SetupService

@Controller
class SetupController implements SetupApi {

    private final SetupService setupService
    private final SecurityService securityService

    SetupController(SetupService setupService, SecurityService securityService) {
        this.setupService = setupService
        this.securityService = securityService
    }

    @Override
    UserResponse completeSetup() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return setupService.completeSetup(email)
    }
}
