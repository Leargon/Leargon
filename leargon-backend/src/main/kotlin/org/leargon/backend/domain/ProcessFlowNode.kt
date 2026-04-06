package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

enum class FlowNodeType { START_EVENT, END_EVENT, TASK, INTERMEDIATE_EVENT, GATEWAY_SPLIT, GATEWAY_JOIN }

enum class FlowEventDefinition { NONE, TIMER, MESSAGE, SIGNAL, CONDITIONAL }

enum class FlowGatewayType { EXCLUSIVE, INCLUSIVE, PARALLEL, COMPLEX }

@Entity
@Table(name = "process_flow_node")
class ProcessFlowNode {
    @Id
    var id: String = ""

    @Column(name = "process_key", nullable = false, length = 500)
    var processKey: String = ""

    @Column(name = "track_id", length = 36)
    var trackId: String? = null

    @Column(name = "position", nullable = false)
    var position: Int = 0

    @Enumerated(EnumType.STRING)
    @Column(name = "node_type", nullable = false, length = 30)
    var nodeType: FlowNodeType = FlowNodeType.START_EVENT

    @Column(name = "label", length = 512)
    var label: String? = null

    @Column(name = "linked_process_key", length = 500)
    var linkedProcessKey: String? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "event_definition", length = 20)
    var eventDefinition: FlowEventDefinition? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "gateway_type", length = 20)
    var gatewayType: FlowGatewayType? = null

    @Column(name = "gateway_pair_id", length = 36)
    var gatewayPairId: String? = null
}
