package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.FlowNodeType
import org.leargon.backend.domain.ProcessFlowNode

@Repository
interface ProcessFlowNodeRepository : JpaRepository<ProcessFlowNode, String> {
    fun findByProcessKeyOrderByPosition(processKey: String): List<ProcessFlowNode>

    fun deleteByProcessKey(processKey: String)

    fun existsByProcessKeyAndNodeTypeNotIn(
        processKey: String,
        nodeTypes: List<FlowNodeType>
    ): Boolean

    fun existsByLinkedProcessKey(linkedProcessKey: String): Boolean

    fun findByLinkedProcessKey(linkedProcessKey: String): List<ProcessFlowNode>
}
