package org.leargon.backend.domain

import io.micronaut.data.annotation.DateUpdated
import jakarta.persistence.Column
import jakarta.persistence.ConstraintMode
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.ForeignKey
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

/**
 * Per-field verification status for a configurable field of a governance entity.
 *
 * Identified by (entityType, entityId, fieldName). `lastValue` is a normalized string snapshot
 * of the field's value, used only for change detection. `updatedBy` is the user who last set the
 * status; it can become null if that user is later deleted, which is why `updatedByUsername` keeps
 * a denormalized snapshot so the "by whom" display survives user deletion.
 */
@Entity
@Table(
    name = "field_verifications",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uq_field_verification_entity_field",
            columnNames = ["entity_type", "entity_id", "field_name"]
        )
    ]
)
class FieldVerification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "entity_type", nullable = false, length = 30)
    var entityType: String = ""

    @Column(name = "entity_id", nullable = false)
    var entityId: Long = 0

    @Column(name = "field_name", nullable = false, length = 120)
    var fieldName: String = ""

    @Column(name = "status", nullable = false, length = 15)
    var status: String = "UNVERIFIED"

    // NOTE: column is "last_known_value", not "last_value" — LAST_VALUE is a reserved word in MySQL 8.
    @Column(name = "last_known_value", columnDefinition = "LONGTEXT")
    var lastValue: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "updated_by_id",
        // No DB-level FK from the Hibernate-generated schema: the username snapshot is the source of
        // truth for display, so a deleted user must not block deletion. The production MySQL FK
        // (Liquibase) uses ON DELETE SET NULL for the same reason.
        foreignKey = ForeignKey(ConstraintMode.NO_CONSTRAINT)
    )
    var updatedBy: User? = null

    @Column(name = "updated_by_username", nullable = false)
    var updatedByUsername: String = ""

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null
}
