package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(
    name = "process_flows",
    uniqueConstraints = [UniqueConstraint(columnNames = ["process_id", "flow_id"])]
)
class ProcessFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id", nullable = false)
    var process: Process? = null

    @Column(name = "flow_id", nullable = false, length = 100)
    var flowId: String = ""

    @Column(name = "source_element_id", nullable = false, length = 100)
    var sourceElementId: String = ""

    @Column(name = "target_element_id", nullable = false, length = 100)
    var targetElementId: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "labels", columnDefinition = "TEXT")
    var labels: MutableList<LocalizedText> = mutableListOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null
}
