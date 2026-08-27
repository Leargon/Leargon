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

    @Column(name = "legal_basis", length = 50)
    var legalBasis: String? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "purpose", columnDefinition = "LONGTEXT")
    var purpose: MutableList<LocalizedText>? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "security_measures", columnDefinition = "LONGTEXT")
    var securityMeasures: MutableList<LocalizedText>? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_owner_id", nullable = true)
    var processOwner: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_steward_id")
    var processSteward: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_custodian_id")
    var technicalCustodian: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_id")
    var updatedBy: User? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "LONGTEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "LONGTEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "LONGTEXT")
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_unit_id")
    var owningUnit: OrganisationalUnit? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bounded_context_id")
    var boundedContext: BoundedContext? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: Process? = null

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    var children: MutableSet<Process> = mutableSetOf()

    @OneToMany(mappedBy = "process", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var versions: MutableSet<ProcessVersion> = mutableSetOf()

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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cross_border_transfers", columnDefinition = "JSON")
    var crossBorderTransfers: MutableList<CrossBorderTransfer>? = null

    @ManyToMany(mappedBy = "linkedProcesses", fetch = FetchType.LAZY)
    var serviceProviders: MutableSet<ServiceProvider> = mutableSetOf()

    @ManyToMany(mappedBy = "linkedProcesses", fetch = FetchType.LAZY)
    var itSystems: MutableSet<ItSystem> = mutableSetOf()

    @ManyToMany(mappedBy = "linkedProcesses", fetch = FetchType.LAZY)
    var capabilities: MutableSet<Capability> = mutableSetOf()

    // ── Value Stream Mapping (Lean / VSM) ────────────────────────────────────
    @Column(name = "value_stream_type", length = 20)
    var valueStreamType: String? = null

    @Column(name = "cycle_time_minutes")
    var cycleTimeMinutes: Double? = null

    @Column(name = "wait_time_minutes")
    var waitTimeMinutes: Double? = null

    @Column(name = "changeover_time_minutes")
    var changeoverTimeMinutes: Double? = null

    @Column(name = "frequency_count")
    var frequencyCount: Int? = null

    @Column(name = "frequency_period", length = 10)
    var frequencyPeriod: String? = null

    @Column(name = "activity_type", length = 25)
    var activityType: String? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "activity_justification", columnDefinition = "LONGTEXT")
    var activityJustification: MutableList<LocalizedText>? = null

    @Column(name = "first_pass_yield")
    var firstPassYield: Double? = null

    @Column(name = "completion_rate")
    var completionRate: Double? = null

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

    /**
     * The unit that answers for this process: its own, else the one owning its bounded context,
     * else the one owning that context's domain. Public because the overview grouping buckets by it.
     */
    fun effectiveOwningUnit(): OrganisationalUnit? =
        owningUnit
            ?: boundedContext?.owningUnit
            ?: boundedContext?.domain?.owningUnit

    fun effectiveOwner(): User? = processOwner ?: effectiveOwningUnit()?.businessOwner

    fun effectiveSteward(): User? = processSteward ?: effectiveOwningUnit()?.businessSteward

    fun getName(locale: String): String = names.textForLocale(locale, key)

    fun getDescription(locale: String): String = descriptions.textForLocale(locale, "")
}
