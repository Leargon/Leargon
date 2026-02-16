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
class LocaleController implements LocaleApi {

    private final LocaleService localeService

    LocaleController(LocaleService localeService) {
        this.localeService = localeService
    }

    @Override
    List<SupportedLocaleResponse> getSupportedLocales(Boolean includeInactive) {
        if (includeInactive) {
            return localeService.getAllLocalesAsResponses()
        }
        return localeService.getActiveLocalesAsResponses()
    }

    @Override
    @Secured("ROLE_ADMIN")
    HttpResponse<SupportedLocaleResponse> createSupportedLocale(CreateSupportedLocaleRequest request) {
        def response = localeService.createLocale(request)
        return HttpResponse.created(response)
    }

    @Override
    @Secured("ROLE_ADMIN")
    SupportedLocaleResponse updateSupportedLocale(Long id, UpdateSupportedLocaleRequest request) {
        return localeService.updateLocale(id, request)
    }

    @Override
    @Secured("ROLE_ADMIN")
    HttpResponse<Void> deleteSupportedLocale(Long id) {
        localeService.deleteLocale(id)
        return HttpResponse.noContent()
    }
}
