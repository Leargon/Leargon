package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.api.ItSystemApi
import org.leargon.backend.model.CreateItSystemRequest
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.UpdateItSystemLinkedProcessesRequest
import org.leargon.backend.model.UpdateItSystemRequest
import org.leargon.backend.service.ItSystemService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ItSystemController(
    private val itSystemService: ItSystemService
) : ItSystemApi {

    override fun getAllItSystems(): List<ItSystemResponse> =
        itSystemService.getAll()

    override fun getItSystem(key: String): ItSystemResponse =
        itSystemService.getByKey(key)

    @Secured("ROLE_ADMIN")
    override fun createItSystem(createItSystemRequest: CreateItSystemRequest): HttpResponse<ItSystemResponse> =
        HttpResponse.created(itSystemService.create(createItSystemRequest))

    @Secured("ROLE_ADMIN")
    override fun updateItSystem(key: String, updateItSystemRequest: UpdateItSystemRequest): ItSystemResponse =
        itSystemService.update(key, updateItSystemRequest)

    @Secured("ROLE_ADMIN")
    override fun deleteItSystem(key: String): HttpResponse<Void> {
        itSystemService.delete(key)
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateItSystemLinkedProcesses(key: String, updateItSystemLinkedProcessesRequest: UpdateItSystemLinkedProcessesRequest): HttpResponse<Void> {
        itSystemService.updateLinkedProcesses(key, updateItSystemLinkedProcessesRequest)
        return HttpResponse.noContent()
    }
}
