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
import jakarta.persistence.JoinTable
import jakarta.persistence.ManyToMany
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "domain_events")
class DomainEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publishing_bounded_context_id")
    var publishingBoundedContext: BoundedContext? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "domain_event_consumers",
        joinColumns = [JoinColumn(name = "event_id")],
        inverseJoinColumns = [JoinColumn(name = "bounded_context_id")]
    )
    var consumers: MutableSet<BoundedContext> = mutableSetOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: key
}
