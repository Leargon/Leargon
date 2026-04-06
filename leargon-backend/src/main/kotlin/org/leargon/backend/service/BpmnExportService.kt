package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.FlowEventDefinition
import org.leargon.backend.domain.FlowGatewayType
import org.leargon.backend.domain.FlowNodeType
import org.leargon.backend.domain.ProcessFlowNode
import org.leargon.backend.domain.ProcessFlowTrack

/**
 * Generates BPMN 2.0 XML from stored flow nodes and tracks.
 * Pure function — no DB access, no side effects.
 * Layout: nodes 120×60 px, 140 px apart horizontally; gateway tracks stacked 100 px apart vertically.
 */
@Singleton
open class BpmnExportService {
    companion object {
        private const val NODE_W = 120
        private const val NODE_H = 60
        private const val H_GAP = 140 // center-to-center horizontal spacing
        private const val V_GAP = 100 // track-to-track vertical spacing
        private const val START_X = 80
        private const val START_Y = 160
        private const val EVENT_SIZE = 36
        private const val GATEWAY_SIZE = 50
    }

    fun export(
        nodes: List<ProcessFlowNode>,
        tracks: List<ProcessFlowTrack>
    ): String {
        if (nodes.isEmpty()) return emptyBpmn()

        val tracksByGateway = tracks.groupBy { it.gatewayNodeId }
        val nodesByTrack = nodes.groupBy { it.trackId }

        // Build layout for root nodes
        val shapes = mutableListOf<ShapeSpec>()
        val flows = mutableListOf<FlowSpec>()
        val flowCounter = Counter()

        layoutTrack(
            trackNodes = nodesByTrack[null] ?: emptyList(),
            nodesByTrack = nodesByTrack,
            tracksByGateway = tracksByGateway,
            startX = START_X,
            startY = START_Y,
            shapes = shapes,
            flows = flows,
            flowCounter = flowCounter
        )

        return buildXml(shapes, flows)
    }

    private data class ShapeSpec(
        val id: String,
        val bpmnType: String,
        val x: Int,
        val y: Int,
        val w: Int,
        val h: Int,
        val name: String?,
        val extra: String = "",
        val childrenXml: String = ""
    )

    private data class FlowSpec(
        val id: String,
        val sourceRef: String,
        val targetRef: String
    )

    private class Counter(
        var value: Int = 0
    ) {
        fun next(): Int = ++value
    }

    private fun layoutTrack(
        trackNodes: List<ProcessFlowNode>,
        nodesByTrack: Map<String?, List<ProcessFlowNode>>,
        tracksByGateway: Map<String, List<ProcessFlowTrack>>,
        startX: Int,
        startY: Int,
        shapes: MutableList<ShapeSpec>,
        flows: MutableList<FlowSpec>,
        flowCounter: Counter
    ): Int {
        val sorted = trackNodes.sortedBy { it.position }
        var x = startX
        var prevId: String? = null

        for (node in sorted) {
            val (w, h) = nodeDimensions(node)
            val cx = x + w / 2
            val cy = startY

            if (node.nodeType == FlowNodeType.GATEWAY_SPLIT) {
                val gatewayTracks = (tracksByGateway[node.id] ?: emptyList()).sortedBy { it.trackIndex }
                val numTracks = gatewayTracks.size.coerceAtLeast(1)
                val totalHeight = numTracks * V_GAP
                val splitY = startY + (numTracks - 1) * V_GAP / 2

                // Place split gateway
                shapes.add(ShapeSpec(node.id, bpmnType(node), cx - w / 2, splitY - h / 2, w, h, node.label, gatewayMarker(node)))
                if (prevId != null) flows.add(FlowSpec("flow_${flowCounter.next()}", prevId, node.id))

                // Find matching join gateway
                val joinNode = sorted.find { it.nodeType == FlowNodeType.GATEWAY_JOIN && it.gatewayPairId == node.gatewayPairId }

                // Layout each track and find max width
                var maxTrackWidth = 0
                gatewayTracks.forEachIndexed { i, track ->
                    val trackY = startY + (i - (numTracks - 1) / 2.0).toInt() * V_GAP
                    val trackNodes2 = (nodesByTrack[track.id] ?: emptyList()).sortedBy { it.position }
                    val trackEndX = layoutTrack(trackNodes2, nodesByTrack, tracksByGateway, x + H_GAP, trackY, shapes, flows, flowCounter)
                    val trackWidth = trackEndX - x
                    if (trackWidth > maxTrackWidth) maxTrackWidth = trackWidth

                    // Connect split to first track node (or join if track empty)
                    val firstTrackNode = trackNodes2.firstOrNull()
                    val lastTrackNode = trackNodes2.lastOrNull()
                    if (firstTrackNode != null) {
                        flows.add(FlowSpec("flow_${flowCounter.next()}", node.id, firstTrackNode.id))
                    }
                    // Connect last track node to join (handled when join is placed)
                    if (joinNode != null && lastTrackNode != null) {
                        flows.add(FlowSpec("flow_${flowCounter.next()}", lastTrackNode.id, joinNode.id))
                    } else if (joinNode != null && firstTrackNode == null) {
                        flows.add(FlowSpec("flow_${flowCounter.next()}", node.id, joinNode.id))
                    }
                }

                // Place join gateway
                if (joinNode != null) {
                    val joinX = x + maxTrackWidth + H_GAP
                    shapes.add(
                        ShapeSpec(
                            joinNode.id,
                            bpmnType(joinNode),
                            joinX - w / 2,
                            splitY - h / 2,
                            w,
                            h,
                            joinNode.label,
                            gatewayMarker(joinNode)
                        )
                    )
                    prevId = joinNode.id
                    x = joinX + H_GAP
                } else {
                    prevId = node.id
                    x += maxTrackWidth + H_GAP
                }
                continue
            }

            if (node.nodeType == FlowNodeType.GATEWAY_JOIN) continue // placed by split handler

            val nodeExtra =
                if (node.nodeType == FlowNodeType.TASK &&
                    node.linkedProcessKey != null
                ) {
                    " calledElement=\"${node.linkedProcessKey}\""
                } else {
                    ""
                }
            val nodeChildren = if (node.nodeType == FlowNodeType.INTERMEDIATE_EVENT) eventDefinitionXml(node) else ""
            shapes.add(ShapeSpec(node.id, bpmnType(node), cx - w / 2, cy - h / 2, w, h, node.label, nodeExtra, nodeChildren))
            if (prevId != null) flows.add(FlowSpec("flow_${flowCounter.next()}", prevId, node.id))
            prevId = node.id
            x += H_GAP
        }
        return x
    }

    private fun nodeDimensions(node: ProcessFlowNode): Pair<Int, Int> =
        when (node.nodeType) {
            FlowNodeType.START_EVENT, FlowNodeType.END_EVENT, FlowNodeType.INTERMEDIATE_EVENT -> Pair(EVENT_SIZE, EVENT_SIZE)
            FlowNodeType.GATEWAY_SPLIT, FlowNodeType.GATEWAY_JOIN -> Pair(GATEWAY_SIZE, GATEWAY_SIZE)
            FlowNodeType.TASK -> Pair(NODE_W, NODE_H)
        }

    private fun bpmnType(node: ProcessFlowNode): String =
        when (node.nodeType) {
            FlowNodeType.START_EVENT -> "bpmn:startEvent"
            FlowNodeType.END_EVENT -> "bpmn:endEvent"
            FlowNodeType.INTERMEDIATE_EVENT -> "bpmn:intermediateCatchEvent"
            FlowNodeType.TASK -> "bpmn:callActivity"
            FlowNodeType.GATEWAY_SPLIT, FlowNodeType.GATEWAY_JOIN ->
                when (node.gatewayType) {
                    FlowGatewayType.INCLUSIVE -> "bpmn:inclusiveGateway"
                    FlowGatewayType.PARALLEL -> "bpmn:parallelGateway"
                    FlowGatewayType.COMPLEX -> "bpmn:complexGateway"
                    else -> "bpmn:exclusiveGateway"
                }
        }

    private fun gatewayMarker(node: ProcessFlowNode): String =
        when (node.gatewayType) {
            FlowGatewayType.EXCLUSIVE -> " markerVisible=\"true\""
            else -> ""
        }

    private fun eventDefinitionXml(node: ProcessFlowNode): String =
        when (node.eventDefinition) {
            FlowEventDefinition.TIMER -> "<bpmn:timerEventDefinition id=\"${node.id}_timer\"/>"
            FlowEventDefinition.MESSAGE -> "<bpmn:messageEventDefinition id=\"${node.id}_msg\"/>"
            FlowEventDefinition.SIGNAL -> "<bpmn:signalEventDefinition id=\"${node.id}_sig\"/>"
            FlowEventDefinition.CONDITIONAL ->
                "<bpmn:conditionalEventDefinition id=\"${node.id}_cond\"><bpmn:condition/></bpmn:conditionalEventDefinition>"
            else -> ""
        }

    private fun buildXml(
        shapes: List<ShapeSpec>,
        flows: List<FlowSpec>
    ): String {
        val sb = StringBuilder()
        sb.append(
            """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
"""
        )
        shapes.forEach { s ->
            val nameAttr = if (s.name != null) " name=\"${s.name.xmlEscape()}\"" else ""
            if (s.childrenXml.isEmpty()) {
                sb.append("    <${s.bpmnType} id=\"${s.id}\"$nameAttr${s.extra}/>\n")
            } else {
                sb.append("    <${s.bpmnType} id=\"${s.id}\"$nameAttr${s.extra}>\n")
                sb.append("      ${s.childrenXml}\n")
                sb.append("    </${s.bpmnType}>\n")
            }
        }
        flows.forEach { f ->
            sb.append("    <bpmn:sequenceFlow id=\"${f.id}\" sourceRef=\"${f.sourceRef}\" targetRef=\"${f.targetRef}\"/>\n")
        }
        sb.append(
            """  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
"""
        )
        shapes.forEach { s ->
            sb.append(
                "      <bpmndi:BPMNShape id=\"shape_${s.id}\" bpmnElement=\"${s.id}\"${s.extra.takeIf {
                    it.contains(
                        "markerVisible"
                    )
                } ?: ""}>\n"
            )
            sb.append("        <dc:Bounds x=\"${s.x}\" y=\"${s.y}\" width=\"${s.w}\" height=\"${s.h}\"/>\n")
            sb.append("      </bpmndi:BPMNShape>\n")
        }
        flows.forEach { f ->
            sb.append("      <bpmndi:BPMNEdge id=\"edge_${f.id}\" bpmnElement=\"${f.id}\"/>\n")
        }
        sb.append(
            """    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>"""
        )
        return sb.toString()
    }

    private fun emptyBpmn(): String =
        """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false"/>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>"""

    private fun String.xmlEscape() = replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}
