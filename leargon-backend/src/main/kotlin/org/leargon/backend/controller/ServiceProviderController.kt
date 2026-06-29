package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import jakarta.validation.Valid
import org.leargon.backend.api.ServiceProviderApi
import org.leargon.backend.model.CreateServiceProviderRequest
import org.leargon.backend.model.ServiceProviderResponse
import org.leargon.backend.model.UpdateServiceProviderProcessLinksRequest
import org.leargon.backend.model.UpdateServiceProviderRequest
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.service.RoleService
import org.leargon.backend.service.ServiceProviderService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ServiceProviderController(
    private val serviceProviderService: ServiceProviderService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val roleService: RoleService
) : ServiceProviderApi {
    override fun getAllServiceProviders(): List<ServiceProviderResponse> = serviceProviderService.getAll()

    override fun getServiceProvider(key: String): ServiceProviderResponse = serviceProviderService.getByKey(key)

    override fun createServiceProvider(
        @Valid @Body createServiceProviderRequest: CreateServiceProviderRequest
    ): HttpResponse<ServiceProviderResponse> {
        roleService.requireCreateRoot(getCurrentUser(), "GDPR")
        val response = serviceProviderService.create(createServiceProviderRequest)
        return HttpResponse.status<ServiceProviderResponse>(HttpStatus.CREATED).body(response)
    }

    @Secured("ROLE_ADMIN")
    override fun updateServiceProvider(
        key: String,
        @Valid @Body updateServiceProviderRequest: UpdateServiceProviderRequest
    ): ServiceProviderResponse = serviceProviderService.update(key, updateServiceProviderRequest)

    @Secured("ROLE_ADMIN")
    override fun deleteServiceProvider(key: String): HttpResponse<Void> {
        serviceProviderService.delete(key)
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateServiceProviderLinkedProcesses(
        key: String,
        @Valid @Body updateServiceProviderProcessLinksRequest: UpdateServiceProviderProcessLinksRequest
    ): HttpResponse<Void> {
        serviceProviderService.updateLinkedProcesses(
            key,
            updateServiceProviderProcessLinksRequest.processKeys ?: emptyList()
        )
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email = securityService.username().orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email).orElseThrow { ResourceNotFoundException("User not found") }
    }
}
