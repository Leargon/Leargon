package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.ProcessApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ProcessMapper
import org.leargon.backend.model.AddProcessEntityRequest
import org.leargon.backend.model.AssignBusinessDomainRequest
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessTreeResponse
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.SaveProcessDiagramRequest
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.model.UpdateCrossBorderTransfersRequest
import org.leargon.backend.model.UpdateLinkedDataProcessorsRequest
import org.leargon.backend.model.UpdateOrgUnitParentsRequest
import org.leargon.backend.model.UpdateProcessCodeRequest
import org.leargon.backend.model.UpdateProcessOwnerRequest
import org.leargon.backend.model.UpdateProcessLegalBasisRequest
import org.leargon.backend.model.UpdateProcessPurposeRequest
import org.leargon.backend.model.UpdateProcessSecurityMeasuresRequest
import org.leargon.backend.model.UpdateProcessTypeRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.DataProcessorService
import org.leargon.backend.service.DpiaService
import org.leargon.backend.service.ProcessDiagramService
import org.leargon.backend.service.ProcessService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class ProcessController(
    private val processService: ProcessService,
    private val processDiagramService: ProcessDiagramService,
    private val classificationService: ClassificationService,
    private val userService: UserService,
    private val securityService: SecurityService,
    private val processMapper: ProcessMapper,
    private val dataProcessorService: DataProcessorService,
    private val dpiaService: DpiaService
) : ProcessApi {

    override fun getAllProcesses(): List<ProcessResponse> =
        processService.getAllProcessesAsResponses()

    override fun getProcessTree(): List<ProcessTreeResponse> =
        processService.getProcessTreeAsResponses()

    override fun getProcessByKey(key: String): ProcessResponse =
        processService.getProcessByKeyAsResponse(key)

    override fun createProcess(@Valid @Body createProcessRequest: CreateProcessRequest): HttpResponse<ProcessResponse> {
        val currentUser = getCurrentUser()
        val process = processService.createProcess(createProcessRequest, currentUser)
        val response = processMapper.toProcessResponse(process)
        return HttpResponse.status<ProcessResponse>(HttpStatus.CREATED).body(response)
    }

    override fun deleteProcess(key: String): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        processService.deleteProcess(key, currentUser)
        return HttpResponse.noContent()
    }

    override fun updateProcessNames(key: String, @Valid @Body names: List<LocalizedText>): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateProcessNames(key, names, currentUser)
    }

    override fun updateProcessDescriptions(key: String, @Valid @Body descriptions: List<LocalizedText>): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateProcessDescriptions(key, descriptions, currentUser)
    }

    override fun updateProcessType(key: String, @Valid @Body request: UpdateProcessTypeRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateProcessType(key, request.processType?.value, currentUser)
    }

    override fun updateProcessLegalBasis(key: String, @Valid @Body request: UpdateProcessLegalBasisRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateLegalBasis(key, request.legalBasis?.value, currentUser)
    }

    override fun updateProcessPurpose(key: String, @Valid @Body request: UpdateProcessPurposeRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updatePurpose(key, request.purpose, currentUser)
    }

    override fun updateProcessSecurityMeasures(key: String, @Valid @Body request: UpdateProcessSecurityMeasuresRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateSecurityMeasures(key, request.securityMeasures, currentUser)
    }

    override fun updateProcessOwner(key: String, @Valid @Body request: UpdateProcessOwnerRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateProcessOwner(key, request.processOwnerUsername, currentUser)
    }

    override fun updateProcessCode(key: String, @Valid @Body request: UpdateProcessCodeRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateProcessCode(key, request.code, currentUser)
    }

    override fun assignBusinessDomainToProcess(key: String, @Valid @Body request: AssignBusinessDomainRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.assignBusinessDomain(key, request.businessDomainKey, currentUser)
    }

    override fun assignClassificationsToProcess(key: String, @Valid @Body assignments: List<ClassificationAssignmentRequest>): ProcessResponse {
        val currentUser = getCurrentUser()
        classificationService.assignClassificationsToProcess(key, assignments, currentUser)
        return processService.getProcessByKeyAsResponse(key)
    }

    override fun getProcessVersions(key: String): List<ProcessVersionResponse> =
        processService.getVersionHistory(key)

    override fun getProcessVersionDiff(key: String, versionNumber: Int): VersionDiffResponse =
        processService.getVersionDiff(key, versionNumber)

    override fun addProcessInput(key: String, @Valid @Body request: AddProcessEntityRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.addInput(key, request, currentUser)
    }

    override fun removeProcessInput(key: String, entityKey: String): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.removeInput(key, entityKey, currentUser)
    }

    override fun addProcessOutput(key: String, @Valid @Body request: AddProcessEntityRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.addOutput(key, request, currentUser)
    }

    override fun removeProcessOutput(key: String, entityKey: String): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.removeOutput(key, entityKey, currentUser)
    }

    override fun assignExecutingUnits(key: String, @Valid @Body request: UpdateOrgUnitParentsRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.assignExecutingUnits(key, request.keys, currentUser)
    }

    override fun updateProcessCrossBorderTransfers(key: String, @Valid @Body updateCrossBorderTransfersRequest: UpdateCrossBorderTransfersRequest): ProcessResponse {
        val currentUser = getCurrentUser()
        return processService.updateCrossBorderTransfers(key, updateCrossBorderTransfersRequest.transfers, currentUser)
    }

    @Secured("ROLE_ADMIN")
    override fun updateProcessDataProcessors(key: String, @Valid @Body updateLinkedDataProcessorsRequest: UpdateLinkedDataProcessorsRequest): HttpResponse<Void> {
        dataProcessorService.updateProcessDataProcessors(key, updateLinkedDataProcessorsRequest.dataProcessorKeys)
        return HttpResponse.noContent()
    }

    override fun getProcessDpia(key: String): DpiaResponse =
        dpiaService.getDpiaForProcess(key)

    override fun triggerProcessDpia(key: String): HttpResponse<DpiaResponse> {
        val currentUser = getCurrentUser()
        val response = dpiaService.triggerForProcess(key, currentUser)
        return HttpResponse.status<DpiaResponse>(HttpStatus.CREATED).body(response)
    }

    override fun getProcessDiagram(key: String): ProcessDiagramResponse =
        processDiagramService.getDiagram(key)

    override fun saveProcessDiagram(key: String, @Valid @Body request: SaveProcessDiagramRequest): ProcessDiagramResponse {
        val currentUser = getCurrentUser()
        return processDiagramService.saveDiagram(key, request, currentUser)
    }

    private fun getCurrentUser(): User {
        val email = securityService.username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
