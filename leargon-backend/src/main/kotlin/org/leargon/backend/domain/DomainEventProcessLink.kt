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
import java.time.Instant

@Entity
@Table(name = "domain_event_process_links")
class DomainEventProcessLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    var event: DomainEvent? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id")
    var process: Process? = null

    @Column(name = "link_type", nullable = false, length = 10)
    var linkType: String = "" // "TRIGGERS" or "HANDLES"

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null
}
