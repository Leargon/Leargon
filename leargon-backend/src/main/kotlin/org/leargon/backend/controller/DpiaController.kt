package org.leargon.backend.controller

import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.DpiaApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.DpiaListItemResponse
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.model.UpdateDpiaFdpicConsultationRequest
import org.leargon.backend.model.UpdateDpiaMeasuresRequest
import org.leargon.backend.model.UpdateDpiaResidualRiskRequest
import org.leargon.backend.model.UpdateDpiaRiskDescriptionRequest
import org.leargon.backend.service.DpiaService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class DpiaController(
    private val dpiaService: DpiaService,
    private val userService: UserService,
    private val securityService: SecurityService
) : DpiaApi {

    override fun getAllDpias(): List<DpiaListItemResponse> =
        dpiaService.getAllDpias()

    override fun updateDpiaRiskDescription(key: String, @Valid @Body updateDpiaRiskDescriptionRequest: UpdateDpiaRiskDescriptionRequest): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.updateRiskDescription(key, updateDpiaRiskDescriptionRequest.riskDescription, currentUser)
    }

    override fun updateDpiaMeasures(key: String, @Valid @Body updateDpiaMeasuresRequest: UpdateDpiaMeasuresRequest): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.updateMeasures(key, updateDpiaMeasuresRequest.measures, currentUser)
    }

    override fun updateDpiaResidualRisk(key: String, @Valid @Body updateDpiaResidualRiskRequest: UpdateDpiaResidualRiskRequest): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.updateResidualRisk(
            key,
            updateDpiaResidualRiskRequest.residualRisk?.value,
            updateDpiaResidualRiskRequest.fdpicConsultationRequired,
            currentUser
        )
    }

    override fun completeDpia(key: String): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.complete(key, currentUser)
    }

    override fun reopenDpia(key: String): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.reopen(key, currentUser)
    }

    override fun updateDpiaFdpicConsultation(key: String, @Valid @Body updateDpiaFdpicConsultationRequest: UpdateDpiaFdpicConsultationRequest): DpiaResponse {
        val currentUser = getCurrentUser()
        return dpiaService.updateFdpicConsultation(
            key,
            updateDpiaFdpicConsultationRequest.fdpicConsultationCompleted,
            updateDpiaFdpicConsultationRequest.fdpicConsultationDate,
            updateDpiaFdpicConsultationRequest.fdpicConsultationOutcome,
            currentUser
        )
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
