package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.SetupApi
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.UserResponse
import org.leargon.backend.service.SetupService

@Controller
open class SetupController(
    private val setupService: SetupService,
    private val securityService: SecurityService
) : SetupApi {

    override fun completeSetup(): UserResponse {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return setupService.completeSetup(email)
    }
}
