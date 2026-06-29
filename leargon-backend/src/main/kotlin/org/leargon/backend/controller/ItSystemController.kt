package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.ItSystemApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.CreateItSystemRequest
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.UpdateItSystemLinkedProcessesRequest
import org.leargon.backend.model.UpdateItSystemProcessingCountriesRequest
import org.leargon.backend.model.UpdateItSystemRequest
import org.leargon.backend.model.UpdateItSystemServiceProvidersRequest
import org.leargon.backend.service.ItSystemService
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ItSystemController(
    private val itSystemService: ItSystemService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService
) : ItSystemApi {
    override fun getAllItSystems(): List<ItSystemResponse> = itSystemService.getAll()

    override fun getItSystem(key: String): ItSystemResponse = itSystemService.getByKey(key)

    override fun createItSystem(createItSystemRequest: CreateItSystemRequest): HttpResponse<ItSystemResponse> {
        roleService.requireCreateRoot(getCurrentUser(), "GDPR")
        return HttpResponse.created(itSystemService.create(createItSystemRequest))
    }

    override fun updateItSystem(
        key: String,
        updateItSystemRequest: UpdateItSystemRequest
    ): ItSystemResponse {
        roleService.requireEditorFor(getCurrentUser(), "GDPR")
        return itSystemService.update(key, updateItSystemRequest)
    }

    override fun deleteItSystem(key: String): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "GDPR")
        itSystemService.delete(key)
        return HttpResponse.noContent()
    }

    override fun updateItSystemLinkedProcesses(
        key: String,
        updateItSystemLinkedProcessesRequest: UpdateItSystemLinkedProcessesRequest
    ): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "GDPR")
        itSystemService.updateLinkedProcesses(key, updateItSystemLinkedProcessesRequest)
        return HttpResponse.noContent()
    }

    override fun updateItSystemServiceProviders(
        key: String,
        updateItSystemServiceProvidersRequest: UpdateItSystemServiceProvidersRequest
    ): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "GDPR")
        itSystemService.updateServiceProviders(key, updateItSystemServiceProvidersRequest)
        return HttpResponse.noContent()
    }

    override fun updateItSystemProcessingCountries(
        key: String,
        updateItSystemProcessingCountriesRequest: UpdateItSystemProcessingCountriesRequest
    ): HttpResponse<Void> {
        roleService.requireEditorFor(getCurrentUser(), "GDPR")
        itSystemService.updateProcessingCountries(key, updateItSystemProcessingCountriesRequest)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email = securityService.username().orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email).orElseThrow { ResourceNotFoundException("User not found") }
    }
}
