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
@Table(name = "business_entities")
class BusinessEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "data_owner_id", nullable = true)
    var dataOwner: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "data_steward_id")
    var dataSteward: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "data_custodian_id")
    var technicalCustodian: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @OneToMany(mappedBy = "businessEntity", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var versions: MutableSet<BusinessEntityVersion> = mutableSetOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bounded_context_id")
    var boundedContext: BoundedContext? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: BusinessEntity? = null

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    var children: MutableSet<BusinessEntity> = mutableSetOf()

    @ManyToMany
    @JoinTable(
        name = "business_entity_interfaces",
        joinColumns = [JoinColumn(name = "interface_id")],
        inverseJoinColumns = [JoinColumn(name = "implementation_id")]
    )
    var interfaceEntities: MutableSet<BusinessEntity> = mutableSetOf()

    @ManyToMany(mappedBy = "interfaceEntities")
    var implementationEntities: MutableSet<BusinessEntity> = mutableSetOf()

    @OneToMany(mappedBy = "firstBusinessEntity", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    var relationshipsFirst: MutableSet<BusinessEntityRelationship> = mutableSetOf()

    @OneToMany(mappedBy = "secondBusinessEntity", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    var relationshipsSecond: MutableSet<BusinessEntityRelationship> = mutableSetOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @Column(name = "retention_period", length = 100)
    var retentionPeriod: String? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "storage_locations", columnDefinition = "JSON")
    var storageLocations: MutableList<String>? = null

    @OneToMany(mappedBy = "businessEntity", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    var qualityRules: MutableList<BusinessDataQualityRule> = mutableListOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun addVersion(businessEntityVersion: BusinessEntityVersion) {
        versions.add(businessEntityVersion)
        businessEntityVersion.businessEntity = this
    }

    fun addChild(child: BusinessEntity) {
        children.add(child)
        child.parent = this
    }

    fun removeChild(child: BusinessEntity) {
        children.remove(child)
        child.parent = null
    }

    fun addImplementation(implementation: BusinessEntity) {
        implementationEntities.add(implementation)
    }

    fun removeImplementation(implementation: BusinessEntity) {
        implementationEntities.remove(implementation)
    }

    fun getAllRelationships(): Set<BusinessEntityRelationship> {
        val all = mutableSetOf<BusinessEntityRelationship>()
        all.addAll(relationshipsFirst)
        relationshipsSecond.forEach { rel -> all.add(rel.swapped()) }
        return all
    }

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.first().text

    fun getDescription(locale: String): String = descriptions.find { it.locale == locale }?.text ?: descriptions.first().text
}
