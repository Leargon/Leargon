package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ProcessElement
import org.leargon.backend.domain.ProcessFlow
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessElementResponse
import org.leargon.backend.model.ProcessElementType
import org.leargon.backend.model.ProcessFlowResponse

@Singleton
open class ProcessDiagramMapper(private val processMapper: ProcessMapper) {

    fun toDiagramResponse(elements: List<ProcessElement>, flows: List<ProcessFlow>): ProcessDiagramResponse {
        return ProcessDiagramResponse(
            elements.map { toElementResponse(it) },
            flows.map { toFlowResponse(it) }
        )
    }

    fun toElementResponse(element: ProcessElement): ProcessElementResponse {
        val response = ProcessElementResponse(
            element.elementId,
            ProcessElementType.fromValue(element.elementType),
            element.sortOrder
        )
        if (element.linkedProcess != null) {
            response.linkedProcess(processMapper.toProcessSummaryResponse(element.linkedProcess))
        }
        if (element.linkedEntity != null) {
            response.linkedEntity(BusinessEntityMapper.toBusinessEntitySummaryResponse(element.linkedEntity))
        }
        if (!element.labels.isNullOrEmpty()) {
            response.labels(LocalizedTextMapper.toModel(element.labels))
        }
        return response
    }

    companion object {
        @JvmStatic
        fun toFlowResponse(flow: ProcessFlow): ProcessFlowResponse {
            val response = ProcessFlowResponse(
                flow.flowId,
                flow.sourceElementId,
                flow.targetElementId
            )
            if (!flow.labels.isNullOrEmpty()) {
                response.labels(LocalizedTextMapper.toModel(flow.labels))
            }
            return response
        }
    }
}
