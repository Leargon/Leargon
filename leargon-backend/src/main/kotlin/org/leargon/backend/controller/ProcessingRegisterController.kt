package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.QueryValue
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.ProcessingRegisterApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.ProcessingRegisterEntryResponse
import org.leargon.backend.service.ProcessingRegisterService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ProcessingRegisterController(
    private val processingRegisterService: ProcessingRegisterService,
    private val userService: UserService,
    private val securityService: SecurityService,
) : ProcessingRegisterApi {
    override fun getProcessingRegister(
        @QueryValue(defaultValue = "en") locale: String
    ): List<ProcessingRegisterEntryResponse> = processingRegisterService.getEntries(locale, getCurrentUser())

    private fun getCurrentUser(): User {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService
            .findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
