package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "process_flow_track")
class ProcessFlowTrack {
    @Id
    var id: String = ""

    @Column(name = "gateway_node_id", nullable = false, length = 36)
    var gatewayNodeId: String = ""

    @Column(name = "track_index", nullable = false)
    var trackIndex: Int = 0

    @Column(name = "label", nullable = true, length = 512)
    var label: String? = null
}
