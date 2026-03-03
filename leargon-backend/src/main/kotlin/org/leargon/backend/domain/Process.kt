package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import jakarta.persistence.CascadeType
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
@Table(name = "processes")
class Process {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @Column(name = "code", length = 100)
    var code: String? = null

    @Column(name = "process_type", length = 20)
    var processType: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_owner_id", nullable = false)
    var processOwner: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    var createdBy: User? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_domain_id")
    var businessDomain: BusinessDomain? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: Process? = null

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    var children: MutableSet<Process> = mutableSetOf()

    @OneToMany(mappedBy = "process", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var versions: MutableSet<ProcessVersion> = mutableSetOf()

    @OneToMany(mappedBy = "process", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var diagramElements: MutableSet<ProcessElement> = mutableSetOf()

    @OneToMany(mappedBy = "process", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var diagramFlows: MutableSet<ProcessFlow> = mutableSetOf()

    @ManyToMany
    @JoinTable(
        name = "process_entity_inputs",
        joinColumns = [JoinColumn(name = "process_id")],
        inverseJoinColumns = [JoinColumn(name = "business_entity_id")]
    )
    var inputEntities: MutableSet<BusinessEntity> = mutableSetOf()

    @ManyToMany
    @JoinTable(
        name = "process_entity_outputs",
        joinColumns = [JoinColumn(name = "process_id")],
        inverseJoinColumns = [JoinColumn(name = "business_entity_id")]
    )
    var outputEntities: MutableSet<BusinessEntity> = mutableSetOf()

    @ManyToMany
    @JoinTable(
        name = "process_executing_units",
        joinColumns = [JoinColumn(name = "process_id")],
        inverseJoinColumns = [JoinColumn(name = "organisational_unit_id")]
    )
    var executingUnits: MutableSet<OrganisationalUnit> = mutableSetOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun addVersion(version: ProcessVersion) {
        versions.add(version)
        version.process = this
    }

    fun getName(locale: String): String {
        return names.find { it.locale == locale }?.text ?: names.first().text
    }

    fun getDescription(locale: String): String {
        return descriptions.find { it.locale == locale }?.text ?: descriptions.first().text
    }
}
