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
import java.time.Instant

@Entity
@Table(name = "context_relationships")
class ContextRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "upstream_domain_id")
    var upstreamDomain: BusinessDomain? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "downstream_domain_id")
    var downstreamDomain: BusinessDomain? = null

    @Column(name = "relationship_type", length = 30, nullable = false)
    var relationshipType: String = ""

    @Column(name = "upstream_role", length = 100)
    var upstreamRole: String? = null

    @Column(name = "downstream_role", length = 100)
    var downstreamRole: String? = null

    @Column(name = "description", columnDefinition = "TEXT")
    var description: String? = null

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
