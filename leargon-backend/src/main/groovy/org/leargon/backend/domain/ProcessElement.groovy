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
@Table(name = "process_elements",
        uniqueConstraints = @UniqueConstraint(columnNames = ["process_id", "element_id"]))
class ProcessElement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id", nullable = false)
    Process process

    @Column(name = "element_id", nullable = false, length = 100)
    String elementId

    @Column(name = "element_type", nullable = false, length = 30)
    String elementType

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_process_id")
    Process linkedProcess

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_entity_id")
    BusinessEntity linkedEntity

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "labels", columnDefinition = "TEXT")
    List<LocalizedText> labels = new ArrayList<>()

    @Column(name = "sort_order", nullable = false)
    Integer sortOrder = 0

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt
}
