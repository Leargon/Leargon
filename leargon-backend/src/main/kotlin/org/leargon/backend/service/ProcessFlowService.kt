package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FlowEventDefinition
import org.leargon.backend.domain.FlowGatewayType
import org.leargon.backend.domain.FlowNodeType
import org.leargon.backend.domain.ProcessFlowNode
import org.leargon.backend.domain.ProcessFlowTrack
import org.leargon.backend.domain.User
import org.leargon.backend.mapper.ProcessFlowMapper
import org.leargon.backend.model.ProcessDiagramResponse
import org.leargon.backend.model.ProcessFlowResponse
import org.leargon.backend.model.SaveProcessFlowRequest
import org.leargon.backend.repository.ProcessFlowNodeRepository
import org.leargon.backend.repository.ProcessFlowTrackRepository

@Singleton
open class ProcessFlowService(
    private val processService: ProcessService,
    private val processFlowNodeRepository: ProcessFlowNodeRepository,
    private val processFlowTrackRepository: ProcessFlowTrackRepository,
    private val processFlowMapper: ProcessFlowMapper,
    private val bpmnExportService: BpmnExportService
) {
    @Transactional
    open fun getFlow(processKey: String): ProcessFlowResponse {
        processService.getProcessByKey(processKey) // validates existence
        val nodes = processFlowNodeRepository.findByProcessKeyOrderByPosition(processKey)
        val trackIds = nodes.mapNotNull { it.trackId }.distinct()
        val tracks =
            if (trackIds.isEmpty()) {
                emptyList()
            } else {
                processFlowTrackRepository.findAll().filter { it.id in trackIds }
            }
        val subProcessKeys = resolveSubProcessKeys(nodes)
        return processFlowMapper.toProcessFlowResponse(processKey, nodes, tracks, subProcessKeys)
    }

    @Transactional
    open fun saveFlow(
        processKey: String,
        request: SaveProcessFlowRequest,
        currentUser: User
    ): ProcessFlowResponse {
        val process = processService.getProcessByKey(processKey)
        ProcessService.checkEditPermission(process, currentUser)

        // Delete all existing nodes (cascades to tracks via fk_flow_track_gateway_node,
        // which in turn cascades to track nodes via fk_flow_node_track)
        processFlowNodeRepository.deleteByProcessKey(processKey)

        fun buildNode(n: org.leargon.backend.model.SaveFlowNodeRequest) =
            ProcessFlowNode().apply {
                id = n.id
                this.processKey = processKey
                trackId = n.trackId
                position = n.position
                nodeType = FlowNodeType.valueOf(n.nodeType.name)
                label = n.label
                linkedProcessKey = n.linkedProcessKey
                eventDefinition = n.eventDefinition?.let { FlowEventDefinition.valueOf(it.name) }
                gatewayType = n.gatewayType?.let { FlowGatewayType.valueOf(it.name) }
                gatewayPairId = n.gatewayPairId
            }

        // Topological save: root nodes → their tracks → those tracks' nodes → repeat.
        // This handles arbitrarily nested gateways where a track node is itself a GATEWAY_SPLIT
        // referenced by deeper tracks.
        val allSavedNodes = mutableListOf<ProcessFlowNode>()
        val allSavedTracks = mutableListOf<ProcessFlowTrack>()
        val savedNodeIds = mutableSetOf<String>()

        // Round 0: root nodes (trackId == null)
        request.nodes.filter { it.trackId == null }.forEach { n ->
            allSavedNodes.add(processFlowNodeRepository.save(buildNode(n)))
            savedNodeIds.add(n.id)
        }

        val pendingTracks = request.tracks.toMutableList()
        val pendingTrackNodes = request.nodes.filter { it.trackId != null }.toMutableList()

        while (pendingTracks.isNotEmpty()) {
            // Tracks whose gateway node is already persisted
            val readyTracks = pendingTracks.filter { it.gatewayNodeId in savedNodeIds }
            if (readyTracks.isEmpty()) break // guard: orphaned data, skip
            pendingTracks.removeAll(readyTracks)

            val newTrackIds = mutableSetOf<String>()
            readyTracks.forEach { t ->
                allSavedTracks.add(
                    processFlowTrackRepository.save(
                        ProcessFlowTrack().apply {
                            id = t.id
                            gatewayNodeId = t.gatewayNodeId
                            trackIndex = t.trackIndex
                            label = t.label
                        }
                    )
                )
                newTrackIds.add(t.id)
            }

            // Save this depth's track nodes (may include nested SPLIT/JOIN nodes)
            val readyNodes = pendingTrackNodes.filter { it.trackId in newTrackIds }
            pendingTrackNodes.removeAll(readyNodes)
            readyNodes.forEach { n ->
                allSavedNodes.add(processFlowNodeRepository.save(buildNode(n)))
                savedNodeIds.add(n.id)
            }
        }
        val subProcessKeys = resolveSubProcessKeys(allSavedNodes)
        processService.recordVersion(processKey, currentUser, "FLOW_UPDATE", "Flow updated")
        return processFlowMapper.toProcessFlowResponse(processKey, allSavedNodes, allSavedTracks, subProcessKeys)
    }

    @Transactional
    open fun exportBpmn(processKey: String): ProcessDiagramResponse {
        processService.getProcessByKey(processKey)
        val nodes = processFlowNodeRepository.findByProcessKeyOrderByPosition(processKey)
        if (nodes.isEmpty()) return ProcessDiagramResponse()
        val trackIds = nodes.mapNotNull { it.trackId }.distinct()
        val tracks =
            if (trackIds.isEmpty()) {
                emptyList()
            } else {
                processFlowTrackRepository.findAll().filter { it.id in trackIds }
            }
        val xml = bpmnExportService.export(nodes, tracks)
        return ProcessDiagramResponse().bpmnXml(xml)
    }

    private fun resolveSubProcessKeys(nodes: List<ProcessFlowNode>): Set<String> {
        val taskKeys =
            nodes
                .filter { it.nodeType == FlowNodeType.TASK }
                .mapNotNull { it.linkedProcessKey }
                .distinct()
        return taskKeys
            .filter { linkedKey ->
                processFlowNodeRepository.existsByProcessKeyAndNodeTypeNotIn(
                    linkedKey,
                    listOf(FlowNodeType.START_EVENT, FlowNodeType.END_EVENT)
                )
            }.toSet()
    }
}
