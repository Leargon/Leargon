package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.ProcessElement
import org.leargon.backend.domain.ProcessFlow
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ProcessDiagramMapper
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessElementInput
import org.leargon.backend.model.ProcessFlowInput
import org.leargon.backend.model.SaveProcessDiagramRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ProcessElementRepository
import org.leargon.backend.repository.ProcessFlowRepository
import org.leargon.backend.repository.ProcessRepository

@Singleton
open class ProcessDiagramService(
    private val processRepository: ProcessRepository,
    private val processElementRepository: ProcessElementRepository,
    private val processFlowRepository: ProcessFlowRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processDiagramMapper: ProcessDiagramMapper,
    private val processService: ProcessService
) {

    companion object {
        val START_EVENT_TYPES: Set<String> = setOf("NONE_START_EVENT")
        val END_EVENT_TYPES: Set<String> = setOf("NONE_END_EVENT", "TERMINATE_END_EVENT")
        val ACTIVITY_TYPES: Set<String> = setOf("TASK", "SUBPROCESS")
        val GATEWAY_TYPES: Set<String> = setOf("EXCLUSIVE_GATEWAY", "INCLUSIVE_GATEWAY", "PARALLEL_GATEWAY")
        val DATA_TYPES: Set<String> = setOf("DATA_INPUT", "DATA_OUTPUT")
        val INTERMEDIATE_EVENT_TYPES: Set<String> = setOf("INTERMEDIATE_EVENT")
    }

    @Transactional
    open fun getDiagram(processKey: String): ProcessDiagramResponse {
        val process = processService.getProcessByKey(processKey)
        val elements = processElementRepository.findByProcessIdOrderBySortOrder(process.id!!)
        val flows = processFlowRepository.findByProcessId(process.id!!)
        return processDiagramMapper.toDiagramResponse(elements, flows)
    }

    @Transactional
    open fun saveDiagram(processKey: String, request: SaveProcessDiagramRequest, currentUser: User): ProcessDiagramResponse {
        val process = processService.getProcessByKey(processKey)
        ProcessService.checkEditPermission(process, currentUser)

        validateDiagram(request)

        // Delete existing diagram data
        processFlowRepository.deleteByProcessId(process.id!!)
        processElementRepository.deleteByProcessId(process.id!!)

        // Create new elements
        for (input in request.elements ?: emptyList()) {
            val element = ProcessElement()
            element.process = process
            element.elementId = input.elementId
            element.elementType = input.elementType.value
            element.sortOrder = input.sortOrder

            if (input.linkedProcessKey != null) {
                element.linkedProcess = processService.getProcessByKey(input.linkedProcessKey)
            } else if (input.createLinkedProcess != null) {
                input.createLinkedProcess!!.parentProcessKey(processKey)
                val childProcess = processService.createProcess(input.createLinkedProcess!!, currentUser)
                element.linkedProcess = childProcess
            }

            if (input.linkedEntityKey != null) {
                val entity = businessEntityRepository.findByKey(input.linkedEntityKey)
                    .orElseThrow { ResourceNotFoundException("Business entity not found: ${input.linkedEntityKey}") }
                element.linkedEntity = entity
            }

            if (!input.labels.isNullOrEmpty()) {
                element.labels = input.labels!!.map { lt -> LocalizedText(lt.locale, lt.text) }.toMutableList()
            }

            processElementRepository.save(element)
        }

        // Create new flows
        for (input in request.flows ?: emptyList()) {
            val flow = ProcessFlow()
            flow.process = process
            flow.flowId = input.flowId
            flow.sourceElementId = input.sourceElementId
            flow.targetElementId = input.targetElementId

            if (!input.labels.isNullOrEmpty()) {
                flow.labels = input.labels!!.map { lt -> LocalizedText(lt.locale, lt.text) }.toMutableList()
            }

            processFlowRepository.save(flow)
        }

        // Record version
        processService.recordVersion(processKey, currentUser, "DIAGRAM_UPDATE", "Updated process diagram")

        // Re-fetch with joins for the response
        val elements = processElementRepository.findByProcessIdOrderBySortOrder(process.id!!)
        val flows = processFlowRepository.findByProcessId(process.id!!)
        return processDiagramMapper.toDiagramResponse(elements, flows)
    }

    private fun validateDiagram(request: SaveProcessDiagramRequest) {
        if (request.elements == null) request.elements = mutableListOf()
        if (request.flows == null) request.flows = mutableListOf()

        // Check for duplicate element IDs
        val elementIds = mutableSetOf<String>()
        for (element in request.elements!!) {
            if (!elementIds.add(element.elementId)) {
                throw IllegalArgumentException("Duplicate element ID: ${element.elementId}")
            }
        }

        // Check for duplicate flow IDs
        val flowIds = mutableSetOf<String>()
        for (flow in request.flows!!) {
            if (!flowIds.add(flow.flowId)) {
                throw IllegalArgumentException("Duplicate flow ID: ${flow.flowId}")
            }
        }

        // Exactly one start event and at least one end event
        val startCount = request.elements!!.count { it.elementType.value in START_EVENT_TYPES }
        val endCount = request.elements!!.count { it.elementType.value in END_EVENT_TYPES }
        if (startCount < 1) {
            throw IllegalArgumentException("Diagram must have at least one start event (found $startCount)")
        }
        if (endCount < 1) {
            throw IllegalArgumentException("Diagram must have at least one end event (found $endCount)")
        }

        // TASK and SUBPROCESS must have a linked process reference
        for (element in request.elements!!) {
            if (element.elementType.value in ACTIVITY_TYPES) {
                if (element.linkedProcessKey == null && element.createLinkedProcess == null) {
                    throw IllegalArgumentException(
                        "Element '${element.elementId}' of type ${element.elementType.value} must have linkedProcessKey or createLinkedProcess")
                }
            }
        }

        // DATA_INPUT and DATA_OUTPUT must have a linked entity reference
        for (element in request.elements!!) {
            if (element.elementType.value in DATA_TYPES) {
                if (element.linkedEntityKey == null) {
                    throw IllegalArgumentException(
                        "Element '${element.elementId}' of type ${element.elementType.value} must have linkedEntityKey")
                }
            }
        }

        // Validate flow references
        for (flow in request.flows!!) {
            if (!elementIds.contains(flow.sourceElementId)) {
                throw IllegalArgumentException(
                    "Flow '${flow.flowId}' references unknown source element: ${flow.sourceElementId}")
            }
            if (!elementIds.contains(flow.targetElementId)) {
                throw IllegalArgumentException(
                    "Flow '${flow.flowId}' references unknown target element: ${flow.targetElementId}")
            }
        }

        // Start events cannot be flow targets; end events cannot be flow sources
        val startEventIds = request.elements!!
            .filter { it.elementType.value in START_EVENT_TYPES }
            .map { it.elementId }.toSet()
        val endEventIds = request.elements!!
            .filter { it.elementType.value in END_EVENT_TYPES }
            .map { it.elementId }.toSet()

        for (flow in request.flows!!) {
            if (flow.targetElementId in startEventIds) {
                throw IllegalArgumentException("Start events cannot be flow targets")
            }
            if (flow.sourceElementId in endEventIds) {
                throw IllegalArgumentException("End events cannot be flow sources")
            }
        }
    }
}
