package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
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

import java.time.Instant

@Serdeable
@Entity
@Table(name = "process_versions",
        uniqueConstraints = @UniqueConstraint(columnNames = ["process_id", "version_number"]))
class ProcessVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id", nullable = false)
    Process process

    @Column(name = "version_number", nullable = false)
    Integer versionNumber

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_id", nullable = false)
    User changedBy

    @Column(name = "change_type", nullable = false, length = 30)
    String changeType

    @Column(name = "snapshot_json", nullable = false, columnDefinition = "JSON")
    String snapshotJson

    @Column(name = "change_summary", columnDefinition = "TEXT")
    String changeSummary

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt
}
