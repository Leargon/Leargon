package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import io.micronaut.serde.annotation.Serdeable
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

@Serdeable
@Entity
@Table(name = "process_flows",
        uniqueConstraints = @UniqueConstraint(columnNames = ["process_id", "flow_id"]))
class ProcessFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id", nullable = false)
    Process process

    @Column(name = "flow_id", nullable = false, length = 100)
    String flowId

    @Column(name = "source_element_id", nullable = false, length = 100)
    String sourceElementId

    @Column(name = "target_element_id", nullable = false, length = 100)
    String targetElementId

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "labels", columnDefinition = "TEXT")
    List<LocalizedText> labels = new ArrayList<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt
}
