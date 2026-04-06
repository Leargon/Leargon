package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessFlowTrack

@Repository
interface ProcessFlowTrackRepository : JpaRepository<ProcessFlowTrack, String> {
    fun findByGatewayNodeIdOrderByTrackIndex(gatewayNodeId: String): List<ProcessFlowTrack>

    fun deleteByGatewayNodeId(gatewayNodeId: String)
}
