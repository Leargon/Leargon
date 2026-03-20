package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import org.leargon.backend.api.LocaleApi
import org.leargon.backend.model.CreateSupportedLocaleRequest
import org.leargon.backend.model.SupportedLocaleResponse
import org.leargon.backend.model.UpdateSupportedLocaleRequest
import org.leargon.backend.service.LocaleService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class LocaleController(
    private val localeService: LocaleService
) : LocaleApi {
    override fun getSupportedLocales(includeInactive: Boolean?): List<SupportedLocaleResponse> =
        if (includeInactive == true) {
            localeService.getAllLocalesAsResponses()
        } else {
            localeService.getActiveLocalesAsResponses()
        }

    @Secured("ROLE_ADMIN")
    override fun createSupportedLocale(request: CreateSupportedLocaleRequest): HttpResponse<SupportedLocaleResponse> {
        val response = localeService.createLocale(request)
        return HttpResponse.created(response)
    }

    @Secured("ROLE_ADMIN")
    override fun updateSupportedLocale(
        id: Long,
        request: UpdateSupportedLocaleRequest
    ): SupportedLocaleResponse = localeService.updateLocale(id, request)

    @Secured("ROLE_ADMIN")
    override fun deleteSupportedLocale(id: Long): HttpResponse<Void> {
        localeService.deleteLocale(id)
        return HttpResponse.noContent()
    }
}
