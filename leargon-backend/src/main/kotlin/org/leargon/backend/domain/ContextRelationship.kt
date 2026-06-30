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

@Entity
@Table(name = "context_relationships")
class ContextRelationship {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "upstream_bounded_context_id")
    var upstreamBoundedContext: BoundedContext? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "downstream_bounded_context_id")
    var downstreamBoundedContext: BoundedContext? = null

    @Column(name = "relationship_type", length = 30, nullable = false)
    var relationshipType: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "upstream_role", columnDefinition = "LONGTEXT")
    var upstreamRole: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "downstream_role", columnDefinition = "LONGTEXT")
    var downstreamRole: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "LONGTEXT")
    var description: MutableList<LocalizedText> = mutableListOf()

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
