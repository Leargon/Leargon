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
import org.leargon.backend.domain.Process
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
import org.leargon.backend.model.UpdateProcessCodeRequest
import org.leargon.backend.model.UpdateOrgUnitParentsRequest
import org.leargon.backend.model.UpdateProcessOwnerRequest
import org.leargon.backend.model.UpdateProcessTypeRequest
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.service.ClassificationService
import org.leargon.backend.service.ProcessDiagramService
import org.leargon.backend.service.ProcessService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
class ProcessController implements ProcessApi {

    private final ProcessService processService
    private final ProcessDiagramService processDiagramService
    private final ClassificationService classificationService
    private final UserService userService
    private final SecurityService securityService
    private final ProcessMapper processMapper

    ProcessController(
            ProcessService processService,
            ProcessDiagramService processDiagramService,
            ClassificationService classificationService,
            UserService userService,
            SecurityService securityService,
            ProcessMapper processMapper
    ) {
        this.processService = processService
        this.processDiagramService = processDiagramService
        this.classificationService = classificationService
        this.userService = userService
        this.securityService = securityService
        this.processMapper = processMapper
    }

    @Override
    List<ProcessResponse> getAllProcesses() {
        return processService.getAllProcessesAsResponses()
    }

    @Override
    List<ProcessTreeResponse> getProcessTree() {
        return processService.getProcessTreeAsResponses()
    }

    @Override
    ProcessResponse getProcessByKey(String key) {
        return processService.getProcessByKeyAsResponse(key)
    }

    @Override
    HttpResponse<ProcessResponse> createProcess(@Valid @Body CreateProcessRequest createProcessRequest) {
        User currentUser = getCurrentUser()
        Process process = processService.createProcess(createProcessRequest, currentUser)
        ProcessResponse response = processMapper.toProcessResponse(process)
        return HttpResponse.status(HttpStatus.CREATED).body(response)
    }

    @Override
    HttpResponse<Void> deleteProcess(String key) {
        User currentUser = getCurrentUser()
        processService.deleteProcess(key, currentUser)
        return HttpResponse.noContent()
    }

    @Override
    ProcessResponse updateProcessNames(String key, @Valid @Body List<LocalizedText> names) {
        User currentUser = getCurrentUser()
        return processService.updateProcessNames(key, names, currentUser)
    }

    @Override
    ProcessResponse updateProcessDescriptions(String key, @Valid @Body List<LocalizedText> descriptions) {
        User currentUser = getCurrentUser()
        return processService.updateProcessDescriptions(key, descriptions, currentUser)
    }

    @Override
    ProcessResponse updateProcessType(String key, @Valid @Body UpdateProcessTypeRequest request) {
        User currentUser = getCurrentUser()
        return processService.updateProcessType(key, request.processType?.value, currentUser)
    }

    @Override
    ProcessResponse updateProcessOwner(String key, @Valid @Body UpdateProcessOwnerRequest request) {
        User currentUser = getCurrentUser()
        return processService.updateProcessOwner(key, request.processOwnerUsername, currentUser)
    }

    @Override
    ProcessResponse updateProcessCode(String key, @Valid @Body UpdateProcessCodeRequest request) {
        User currentUser = getCurrentUser()
        return processService.updateProcessCode(key, request.code, currentUser)
    }

    @Override
    ProcessResponse assignBusinessDomainToProcess(
            String key,
            @Valid @Body AssignBusinessDomainRequest request
    ) {
        User currentUser = getCurrentUser()
        return processService.assignBusinessDomain(key, request.businessDomainKey, currentUser)
    }

    @Override
    ProcessResponse assignClassificationsToProcess(
            String key,
            @Valid @Body List<ClassificationAssignmentRequest> assignments
    ) {
        User currentUser = getCurrentUser()
        classificationService.assignClassificationsToProcess(key, assignments, currentUser)
        return processService.getProcessByKeyAsResponse(key)
    }

    @Override
    List<ProcessVersionResponse> getProcessVersions(String key) {
        return processService.getVersionHistory(key)
    }

    @Override
    VersionDiffResponse getProcessVersionDiff(String key, Integer versionNumber) {
        return processService.getVersionDiff(key, versionNumber)
    }

    @Override
    ProcessResponse addProcessInput(String key, @Valid @Body AddProcessEntityRequest request) {
        User currentUser = getCurrentUser()
        return processService.addInput(key, request, currentUser)
    }

    @Override
    ProcessResponse removeProcessInput(String key, String entityKey) {
        User currentUser = getCurrentUser()
        return processService.removeInput(key, entityKey, currentUser)
    }

    @Override
    ProcessResponse addProcessOutput(String key, @Valid @Body AddProcessEntityRequest request) {
        User currentUser = getCurrentUser()
        return processService.addOutput(key, request, currentUser)
    }

    @Override
    ProcessResponse removeProcessOutput(String key, String entityKey) {
        User currentUser = getCurrentUser()
        return processService.removeOutput(key, entityKey, currentUser)
    }

    @Override
    ProcessResponse assignExecutingUnits(String key, @Valid @Body UpdateOrgUnitParentsRequest request) {
        User currentUser = getCurrentUser()
        return processService.assignExecutingUnits(key, request.keys, currentUser)
    }

    @Override
    ProcessDiagramResponse getProcessDiagram(String key) {
        return processDiagramService.getDiagram(key)
    }

    @Override
    ProcessDiagramResponse saveProcessDiagram(String key, @Valid @Body SaveProcessDiagramRequest request) {
        User currentUser = getCurrentUser()
        return processDiagramService.saveDiagram(key, request, currentUser)
    }

    private User getCurrentUser() {
        String email = securityService.username()
                .orElseThrow(() -> new ResourceNotFoundException("User not authenticated"))
        return userService.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }
}
