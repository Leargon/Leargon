package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.FlowEventDefinition
import org.leargon.backend.domain.FlowGatewayType
import org.leargon.backend.domain.FlowNodeType
import org.leargon.backend.domain.ProcessFlowNode
import org.leargon.backend.domain.ProcessFlowTrack
import org.leargon.backend.model.EventDefinition
import org.leargon.backend.model.FlowNodeResponse
import org.leargon.backend.model.FlowNodeType as ApiFlowNodeType
import org.leargon.backend.model.FlowTrackResponse
import org.leargon.backend.model.GatewayType
import org.leargon.backend.model.ProcessFlowResponse

@Singleton
open class ProcessFlowMapper {

    fun toFlowNodeResponse(node: ProcessFlowNode, isSubProcess: Boolean = false): FlowNodeResponse {
        val response = FlowNodeResponse(node.id, node.position, toApiNodeType(node.nodeType))
        response.trackId(node.trackId)
        response.label(node.label)
        response.linkedProcessKey(node.linkedProcessKey)
        response.isSubProcess(isSubProcess)
        response.eventDefinition(node.eventDefinition?.let { toApiEventDef(it) })
        response.gatewayType(node.gatewayType?.let { toApiGatewayType(it) })
        response.gatewayPairId(node.gatewayPairId)
        return response
    }

    fun toFlowTrackResponse(track: ProcessFlowTrack, nodes: List<ProcessFlowNode>, subProcessKeys: Set<String>): FlowTrackResponse {
        val nodeResponses = nodes
            .sortedBy { it.position }
            .map { toFlowNodeResponse(it, it.linkedProcessKey != null && it.linkedProcessKey in subProcessKeys) }
        return FlowTrackResponse(track.id, track.gatewayNodeId, track.trackIndex, nodeResponses)
    }

    fun toProcessFlowResponse(
        processKey: String,
        allNodes: List<ProcessFlowNode>,
        allTracks: List<ProcessFlowTrack>,
        subProcessKeys: Set<String>,
    ): ProcessFlowResponse {
        val nodesByTrack = allNodes.groupBy { it.trackId }
        val rootNodes = (nodesByTrack[null] ?: emptyList())
            .sortedBy { it.position }
            .map { toFlowNodeResponse(it, it.linkedProcessKey != null && it.linkedProcessKey in subProcessKeys) }

        val trackResponses = allTracks.sortedBy { it.trackIndex }.map { track ->
            val trackNodes = nodesByTrack[track.id] ?: emptyList()
            toFlowTrackResponse(track, trackNodes, subProcessKeys)
        }

        return ProcessFlowResponse(processKey, rootNodes, trackResponses)
    }

    private fun toApiNodeType(type: FlowNodeType): ApiFlowNodeType = when (type) {
        FlowNodeType.START_EVENT -> ApiFlowNodeType.START_EVENT
        FlowNodeType.END_EVENT -> ApiFlowNodeType.END_EVENT
        FlowNodeType.TASK -> ApiFlowNodeType.TASK
        FlowNodeType.INTERMEDIATE_EVENT -> ApiFlowNodeType.INTERMEDIATE_EVENT
        FlowNodeType.GATEWAY_SPLIT -> ApiFlowNodeType.GATEWAY_SPLIT
        FlowNodeType.GATEWAY_JOIN -> ApiFlowNodeType.GATEWAY_JOIN
    }

    private fun toApiEventDef(def: FlowEventDefinition): EventDefinition = when (def) {
        FlowEventDefinition.NONE -> EventDefinition.NONE
        FlowEventDefinition.TIMER -> EventDefinition.TIMER
        FlowEventDefinition.MESSAGE -> EventDefinition.MESSAGE
        FlowEventDefinition.SIGNAL -> EventDefinition.SIGNAL
        FlowEventDefinition.CONDITIONAL -> EventDefinition.CONDITIONAL
    }

    private fun toApiGatewayType(type: FlowGatewayType): GatewayType = when (type) {
        FlowGatewayType.EXCLUSIVE -> GatewayType.EXCLUSIVE
        FlowGatewayType.INCLUSIVE -> GatewayType.INCLUSIVE
        FlowGatewayType.PARALLEL -> GatewayType.PARALLEL
        FlowGatewayType.COMPLEX -> GatewayType.COMPLEX
    }
}
