package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.DataProcessorApi
import org.leargon.backend.model.CreateDataProcessorRequest
import org.leargon.backend.model.DataProcessorResponse
import org.leargon.backend.model.UpdateDataProcessorEntityLinksRequest
import org.leargon.backend.model.UpdateDataProcessorProcessLinksRequest
import org.leargon.backend.model.UpdateDataProcessorRequest
import org.leargon.backend.service.DataProcessorService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class DataProcessorController(
    private val dataProcessorService: DataProcessorService,
    private val userService: UserService,
    private val securityService: SecurityService
) : DataProcessorApi {
    override fun getAllDataProcessors(): List<DataProcessorResponse> = dataProcessorService.getAll()

    override fun getDataProcessor(key: String): DataProcessorResponse = dataProcessorService.getByKey(key)

    @Secured("ROLE_ADMIN")
    override fun createDataProcessor(
        @Valid @Body createDataProcessorRequest: CreateDataProcessorRequest
    ): HttpResponse<DataProcessorResponse> {
        val response = dataProcessorService.create(createDataProcessorRequest)
        return HttpResponse.status<DataProcessorResponse>(HttpStatus.CREATED).body(response)
    }

    @Secured("ROLE_ADMIN")
    override fun updateDataProcessor(
        key: String,
        @Valid @Body updateDataProcessorRequest: UpdateDataProcessorRequest
    ): DataProcessorResponse = dataProcessorService.update(key, updateDataProcessorRequest)

    @Secured("ROLE_ADMIN")
    override fun deleteDataProcessor(key: String): HttpResponse<Void> {
        dataProcessorService.delete(key)
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateDataProcessorLinkedEntities(
        key: String,
        @Valid @Body updateDataProcessorEntityLinksRequest: UpdateDataProcessorEntityLinksRequest
    ): HttpResponse<Void> {
        dataProcessorService.updateLinkedEntities(key, updateDataProcessorEntityLinksRequest.businessEntityKeys ?: emptyList())
        return HttpResponse.noContent()
    }

    @Secured("ROLE_ADMIN")
    override fun updateDataProcessorLinkedProcesses(
        key: String,
        @Valid @Body updateDataProcessorProcessLinksRequest: UpdateDataProcessorProcessLinksRequest
    ): HttpResponse<Void> {
        dataProcessorService.updateLinkedProcesses(key, updateDataProcessorProcessLinksRequest.processKeys ?: emptyList())
        return HttpResponse.noContent()
    }
}
