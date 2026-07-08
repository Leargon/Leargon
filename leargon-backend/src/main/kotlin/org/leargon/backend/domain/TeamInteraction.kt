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
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * A typed Team Topologies interaction between two organisational units (teams).
 * [mode] ∈ COLLABORATION / X_AS_A_SERVICE / FACILITATING; [duration] ∈ TEMPORARY / ONGOING.
 */
@Entity
@Table(name = "team_interactions")
class TeamInteraction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_unit_id", nullable = false)
    var sourceUnit: OrganisationalUnit? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_unit_id", nullable = false)
    var targetUnit: OrganisationalUnit? = null

    @Column(name = "mode", length = 20, nullable = false)
    var mode: String = ""

    @Column(name = "duration", length = 20, nullable = false)
    var duration: String = ""

    @Column(name = "health_score")
    var healthScore: Int? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notes", columnDefinition = "LONGTEXT")
    var notes: MutableList<LocalizedText>? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null
}
