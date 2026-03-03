package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
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

@Entity
@Table(
    name = "process_versions",
    uniqueConstraints = [UniqueConstraint(columnNames = ["process_id", "version_number"])]
)
class ProcessVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id", nullable = false)
    var process: Process? = null

    @Column(name = "version_number", nullable = false)
    var versionNumber: Int = 0

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_id", nullable = false)
    var changedBy: User? = null

    @Column(name = "change_type", nullable = false, length = 30)
    var changeType: String = ""

    @Column(name = "snapshot_json", nullable = false, columnDefinition = "JSON")
    var snapshotJson: String = ""

    @Column(name = "change_summary", columnDefinition = "TEXT")
    var changeSummary: String? = null

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null
}
