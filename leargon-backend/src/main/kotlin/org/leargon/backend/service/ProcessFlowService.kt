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
        val tracks = if (trackIds.isEmpty()) emptyList()
                     else processFlowTrackRepository.findAll().filter { it.id in trackIds }
        val subProcessKeys = resolveSubProcessKeys(nodes)
        return processFlowMapper.toProcessFlowResponse(processKey, nodes, tracks, subProcessKeys)
    }

    @Transactional
    open fun saveFlow(processKey: String, request: SaveProcessFlowRequest, currentUser: User): ProcessFlowResponse {
        val process = processService.getProcessByKey(processKey)
        ProcessService.checkEditPermission(process, currentUser)

        // Delete all existing nodes and tracks for this process
        processFlowNodeRepository.deleteByProcessKey(processKey)

        // Save tracks first (nodes reference them via FK)
        val savedTracks = request.tracks.map { t ->
            val track = ProcessFlowTrack().apply {
                id = t.id
                gatewayNodeId = t.gatewayNodeId
                trackIndex = t.trackIndex
            }
            processFlowTrackRepository.save(track)
        }

        // Save nodes
        val savedNodes = request.nodes.map { n ->
            val node = ProcessFlowNode().apply {
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
            processFlowNodeRepository.save(node)
        }

        val subProcessKeys = resolveSubProcessKeys(savedNodes)
        return processFlowMapper.toProcessFlowResponse(processKey, savedNodes, savedTracks, subProcessKeys)
    }

    @Transactional
    open fun exportBpmn(processKey: String): ProcessDiagramResponse {
        processService.getProcessByKey(processKey)
        val nodes = processFlowNodeRepository.findByProcessKeyOrderByPosition(processKey)
        if (nodes.isEmpty()) return ProcessDiagramResponse()
        val trackIds = nodes.mapNotNull { it.trackId }.distinct()
        val tracks = if (trackIds.isEmpty()) emptyList()
                     else processFlowTrackRepository.findAll().filter { it.id in trackIds }
        val xml = bpmnExportService.export(nodes, tracks)
        return ProcessDiagramResponse().bpmnXml(xml)
    }

    private fun resolveSubProcessKeys(nodes: List<ProcessFlowNode>): Set<String> {
        val taskKeys = nodes
            .filter { it.nodeType == FlowNodeType.TASK }
            .mapNotNull { it.linkedProcessKey }
            .distinct()
        return taskKeys.filter { linkedKey ->
            processFlowNodeRepository.existsByProcessKeyAndNodeTypeNotIn(
                linkedKey,
                listOf(FlowNodeType.START_EVENT, FlowNodeType.END_EVENT)
            )
        }.toSet()
    }
}
