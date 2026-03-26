package org.leargon.backend.domain

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
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "capabilities")
class Capability {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", unique = true, nullable = false, length = 200)
    var key: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON", nullable = false)
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON", nullable = false)
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "JSON", nullable = false)
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: Capability? = null

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    var children: MutableSet<Capability> = mutableSetOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_unit_id")
    var owningUnit: OrganisationalUnit? = null

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "capability_processes",
        joinColumns = [JoinColumn(name = "capability_id")],
        inverseJoinColumns = [JoinColumn(name = "process_id")]
    )
    var linkedProcesses: MutableSet<Process> = mutableSetOf()

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now()

    @Column(name = "updated_at")
    var updatedAt: Instant? = null

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: key
}
