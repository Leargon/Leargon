package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.SaveProcessDiagramRequest
import org.leargon.backend.repository.ProcessRepository

@Singleton
open class ProcessDiagramService(
    private val processRepository: ProcessRepository,
    private val processService: ProcessService
) {
    @Transactional
    open fun getDiagram(processKey: String): ProcessDiagramResponse {
        val process = processService.getProcessByKey(processKey)
        return ProcessDiagramResponse().bpmnXml(process.bpmnXml)
    }

    @Transactional
    open fun saveDiagram(
        processKey: String,
        request: SaveProcessDiagramRequest,
        currentUser: User
    ): ProcessDiagramResponse {
        val process = processService.getProcessByKey(processKey)
        ProcessService.checkEditPermission(process, currentUser)
        process.bpmnXml = request.bpmnXml
        processRepository.update(process)
        processService.recordVersion(processKey, currentUser, "DIAGRAM_UPDATE", "Updated BPMN diagram")
        return ProcessDiagramResponse().bpmnXml(process.bpmnXml)
    }
}
