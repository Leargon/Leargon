package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.MediaType
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.QueryValue
import io.micronaut.security.annotation.Secured
import org.leargon.backend.service.ExportService

@Controller("/export")
@Secured("ROLE_ADMIN")
open class ExportController(
    private val exportService: ExportService,
) {
    @Get("/processing-register")
    fun exportProcessingRegister(
        @QueryValue(defaultValue = "en") locale: String
    ): HttpResponse<String> {
        val csv = exportService.exportProcessingRegister(locale)
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"processing-register.csv\"")
    }

    @Get("/data-processors")
    fun exportDataProcessors(
        @QueryValue(defaultValue = "en") locale: String
    ): HttpResponse<String> {
        val csv = exportService.exportDataProcessors(locale)
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"data-processors.csv\"")
    }

    @Get("/dpia-register")
    fun exportDpiaRegister(): HttpResponse<String> {
        val csv = exportService.exportDpiaRegister()
        return HttpResponse
            .ok(csv)
            .contentType(MediaType.of("text/csv;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"dpia-register.csv\"")
    }

    @Get("/context-map")
    fun exportContextMap(
        @QueryValue(defaultValue = "en") locale: String
    ): HttpResponse<String> {
        val cml = exportService.exportContextMap(locale)
        return HttpResponse
            .ok(cml)
            .contentType(MediaType.of("text/plain;charset=UTF-8"))
            .header("Content-Disposition", "attachment; filename=\"context-map.cml\"")
    }
}
