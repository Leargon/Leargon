package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ProcessElement
import org.leargon.backend.domain.ProcessFlow
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessElementResponse
import org.leargon.backend.model.ProcessElementType
import org.leargon.backend.model.ProcessFlowResponse

@Singleton
class ProcessDiagramMapper {

    private final ProcessMapper processMapper

    ProcessDiagramMapper(ProcessMapper processMapper) {
        this.processMapper = processMapper
    }

    ProcessDiagramResponse toDiagramResponse(List<ProcessElement> elements, List<ProcessFlow> flows) {
        def pm = this.processMapper
        return new ProcessDiagramResponse(
                elements.collect { toElementResponse(it, pm) },
                flows.collect { toFlowResponse(it) }
        )
    }

    static ProcessElementResponse toElementResponse(ProcessElement element, ProcessMapper pm) {
        def response = new ProcessElementResponse(
                element.elementId,
                ProcessElementType.fromValue(element.elementType),
                element.sortOrder
        )
        if (element.linkedProcess != null) {
            response.linkedProcess(pm.toProcessSummaryResponse(element.linkedProcess))
        }
        if (element.linkedEntity != null) {
            response.linkedEntity(BusinessEntityMapper.toBusinessEntitySummaryResponse(element.linkedEntity))
        }
        if (element.labels != null && !element.labels.isEmpty()) {
            response.labels(LocalizedTextMapper.toModel(element.labels))
        }
        return response
    }

    static ProcessFlowResponse toFlowResponse(ProcessFlow flow) {
        def response = new ProcessFlowResponse(
                flow.flowId,
                flow.sourceElementId,
                flow.targetElementId
        )
        if (flow.labels != null && !flow.labels.isEmpty()) {
            response.labels(LocalizedTextMapper.toModel(flow.labels))
        }
        return response
    }
}
