package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.MediaType
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.QueryValue
import io.micronaut.security.annotation.Secured
import org.leargon.backend.service.BusinessDataQualityRuleService
import org.leargon.backend.service.DefaultLocaleProvider
import org.leargon.backend.service.ExportService

@Controller("/export")
@Secured("ROLE_ADMIN")
open class ExportController(
    private val exportService: ExportService,
    private val businessDataQualityRuleService: BusinessDataQualityRuleService,
    private val defaultLocaleProvider: DefaultLocaleProvider,
) {
    /**
     * The locale to render an export in: the one the caller asked for, otherwise the tenant default.
     * The parameter used to default to `"en"`, which handed a German tenant an English CSV unless the
     * UI remembered to pass a locale.
     */
    private fun resolve(locale: String?): String = locale?.takeIf { it.isNotBlank() } ?: defaultLocaleProvider.code()

    @Get("/processing-register")
    fun exportProcessingRegister(
        @QueryValue locale: String?
    ): HttpResponse<String> {
        val csv = exportService.exportProcessingRegister(resolve(locale))
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"processing-register.csv\"")
    }

    @Get("/service-providers")
    fun exportServiceProviders(
        @QueryValue locale: String?
    ): HttpResponse<String> {
        val csv = exportService.exportServiceProviders(resolve(locale))
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"service-providers.csv\"")
    }

    @Get("/dpia-register")
    fun exportDpiaRegister(
        @QueryValue locale: String?,
    ): HttpResponse<String> {
        val csv = exportService.exportDpiaRegister(resolve(locale))
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"dpia-register.csv\"")
    }

    @Get("/business-data-quality-rules")
    fun exportBusinessDataQualityRules(
        @QueryValue locale: String?
    ): HttpResponse<String> {
        val csv = exportService.exportBusinessDataQualityRules(businessDataQualityRuleService.getAllRules(), resolve(locale))
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"business-data-quality-rules.csv\"")
    }

    @Get("/context-map")
    fun exportContextMap(
        @QueryValue locale: String?
    ): HttpResponse<String> {
        val cml = exportService.exportContextMap(resolve(locale))
        return HttpResponse
            .ok(cml)
            .contentType(MediaType.of("text/plain;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"context-map.cml\"")
    }
}
