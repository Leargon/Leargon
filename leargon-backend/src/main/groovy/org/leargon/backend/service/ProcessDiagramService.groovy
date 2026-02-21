package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.Process
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
class ProcessDiagramService {

    static final Set<String> START_EVENT_TYPES = ['NONE_START_EVENT'] as Set
    static final Set<String> END_EVENT_TYPES = ['NONE_END_EVENT', 'TERMINATE_END_EVENT'] as Set
    static final Set<String> ACTIVITY_TYPES = ['TASK', 'SUBPROCESS'] as Set
    static final Set<String> GATEWAY_TYPES = ['EXCLUSIVE_GATEWAY', 'INCLUSIVE_GATEWAY', 'PARALLEL_GATEWAY'] as Set
    static final Set<String> DATA_TYPES = ['DATA_INPUT', 'DATA_OUTPUT'] as Set
    static final Set<String> INTERMEDIATE_EVENT_TYPES = ['INTERMEDIATE_EVENT'] as Set

    private final ProcessRepository processRepository
    private final ProcessElementRepository processElementRepository
    private final ProcessFlowRepository processFlowRepository
    private final BusinessEntityRepository businessEntityRepository
    private final ProcessDiagramMapper processDiagramMapper
    private final ProcessService processService

    ProcessDiagramService(
            ProcessRepository processRepository,
            ProcessElementRepository processElementRepository,
            ProcessFlowRepository processFlowRepository,
            BusinessEntityRepository businessEntityRepository,
            ProcessDiagramMapper processDiagramMapper,
            ProcessService processService
    ) {
        this.processRepository = processRepository
        this.processElementRepository = processElementRepository
        this.processFlowRepository = processFlowRepository
        this.businessEntityRepository = businessEntityRepository
        this.processDiagramMapper = processDiagramMapper
        this.processService = processService
    }

    @Transactional
    ProcessDiagramResponse getDiagram(String processKey) {
        Process process = processService.getProcessByKey(processKey)
        def elemRepo = this.processElementRepository
        def flowRepo = this.processFlowRepository
        def mapper = this.processDiagramMapper

        List<ProcessElement> elements = elemRepo.findByProcessIdOrderBySortOrder(process.id)
        List<ProcessFlow> flows = flowRepo.findByProcessId(process.id)
        return mapper.toDiagramResponse(elements, flows)
    }

    @Transactional
    ProcessDiagramResponse saveDiagram(String processKey, SaveProcessDiagramRequest request, User currentUser) {
        Process process = processService.getProcessByKey(processKey)
        ProcessService.checkEditPermission(process, currentUser)

        validateDiagram(request)

        def elemRepo = this.processElementRepository
        def flowRepo = this.processFlowRepository
        def entityRepo = this.businessEntityRepository
        def procService = this.processService
        def mapper = this.processDiagramMapper

        // Delete existing diagram data
        flowRepo.deleteByProcessId(process.id)
        elemRepo.deleteByProcessId(process.id)

        // Create new elements
        for (ProcessElementInput input : request.elements) {
            ProcessElement element = new ProcessElement()
            element.process = process
            element.elementId = input.elementId
            element.elementType = input.elementType.value
            element.sortOrder = input.sortOrder

            // Handle linked process (for TASK / SUBPROCESS)
            if (input.linkedProcessKey != null) {
                element.linkedProcess = procService.getProcessByKey(input.linkedProcessKey)
            } else if (input.createLinkedProcess != null) {
                input.createLinkedProcess.parentProcessKey(processKey)
                Process childProcess = procService.createProcess(input.createLinkedProcess, currentUser)
                element.linkedProcess = childProcess
            }

            // Handle linked entity (for DATA_INPUT / DATA_OUTPUT)
            if (input.linkedEntityKey != null) {
                BusinessEntity entity = entityRepo.findByKey(input.linkedEntityKey)
                        .orElseThrow(() -> new ResourceNotFoundException("Business entity not found: ${input.linkedEntityKey}"))
                element.linkedEntity = entity
            }

            // Handle labels
            if (input.labels != null && !input.labels.isEmpty()) {
                element.labels = input.labels.collect { lt ->
                    new LocalizedText(lt.locale, lt.text)
                }
            }

            elemRepo.save(element)
        }

        // Create new flows
        for (ProcessFlowInput input : request.flows) {
            ProcessFlow flow = new ProcessFlow()
            flow.process = process
            flow.flowId = input.flowId
            flow.sourceElementId = input.sourceElementId
            flow.targetElementId = input.targetElementId

            if (input.labels != null && !input.labels.isEmpty()) {
                flow.labels = input.labels.collect { lt ->
                    new LocalizedText(lt.locale, lt.text)
                }
            }

            flowRepo.save(flow)
        }

        // Record version
        procService.recordVersion(processKey, currentUser, "DIAGRAM_UPDATE", "Updated process diagram")

        // Re-fetch with joins for the response
        List<ProcessElement> elements = elemRepo.findByProcessIdOrderBySortOrder(process.id)
        List<ProcessFlow> flows = flowRepo.findByProcessId(process.id)
        return mapper.toDiagramResponse(elements, flows)
    }

    private static void validateDiagram(SaveProcessDiagramRequest request) {
        if (request.elements == null) {
            request.elements = []
        }
        if (request.flows == null) {
            request.flows = []
        }

        // Check for duplicate element IDs
        Set<String> elementIds = new HashSet<>()
        for (ProcessElementInput element : request.elements) {
            if (!elementIds.add(element.elementId)) {
                throw new IllegalArgumentException("Duplicate element ID: ${element.elementId}")
            }
        }

        // Check for duplicate flow IDs
        Set<String> flowIds = new HashSet<>()
        for (ProcessFlowInput flow : request.flows) {
            if (!flowIds.add(flow.flowId)) {
                throw new IllegalArgumentException("Duplicate flow ID: ${flow.flowId}")
            }
        }

        // Exactly one start event and at least one end event
        long startCount = request.elements.count { it.elementType.value in START_EVENT_TYPES }
        long endCount = request.elements.count { it.elementType.value in END_EVENT_TYPES }
        if (startCount < 1) {
            throw new IllegalArgumentException("Diagram must have at least one start event (found ${startCount})")
        }
        if (endCount < 1) {
            throw new IllegalArgumentException("Diagram must have at least one end event (found ${endCount})")
        }

        // TASK and SUBPROCESS must have a linked process reference
        for (ProcessElementInput element : request.elements) {
            if (element.elementType.value in ACTIVITY_TYPES) {
                if (element.linkedProcessKey == null && element.createLinkedProcess == null) {
                    throw new IllegalArgumentException(
                            "Element '${element.elementId}' of type ${element.elementType.value} must have linkedProcessKey or createLinkedProcess")
                }
            }
        }

        // DATA_INPUT and DATA_OUTPUT must have a linked entity reference
        for (ProcessElementInput element : request.elements) {
            if (element.elementType.value in DATA_TYPES) {
                if (element.linkedEntityKey == null) {
                    throw new IllegalArgumentException(
                            "Element '${element.elementId}' of type ${element.elementType.value} must have linkedEntityKey")
                }
            }
        }

        // Validate flow references (only sequence flow elements, not data objects)
        Set<String> flowableElementIds = new HashSet<>()
        for (ProcessElementInput element : request.elements) {
            if (!(element.elementType.value in DATA_TYPES)) {
                flowableElementIds.add(element.elementId)
            }
        }

        for (ProcessFlowInput flow : request.flows) {
            if (!elementIds.contains(flow.sourceElementId)) {
                throw new IllegalArgumentException(
                        "Flow '${flow.flowId}' references unknown source element: ${flow.sourceElementId}")
            }
            if (!elementIds.contains(flow.targetElementId)) {
                throw new IllegalArgumentException(
                        "Flow '${flow.flowId}' references unknown target element: ${flow.targetElementId}")
            }
        }

        // Start events cannot be flow targets; end events cannot be flow sources
        Set<String> startEventIds = request.elements
                .findAll { it.elementType.value in START_EVENT_TYPES }
                .collect { it.elementId } as Set
        Set<String> endEventIds = request.elements
                .findAll { it.elementType.value in END_EVENT_TYPES }
                .collect { it.elementId } as Set

        for (ProcessFlowInput flow : request.flows) {
            if (flow.targetElementId in startEventIds) {
                throw new IllegalArgumentException("Start events cannot be flow targets")
            }
            if (flow.sourceElementId in endEventIds) {
                throw new IllegalArgumentException("End events cannot be flow sources")
            }
        }
    }
}
