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
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "business_domains")
class BusinessDomain {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    var parent: BusinessDomain? = null

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    var children: MutableSet<BusinessDomain> = mutableSetOf()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_unit_id")
    var owningUnit: OrganisationalUnit? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @OneToMany(mappedBy = "businessDomain", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var versions: MutableSet<BusinessDomainVersion> = mutableSetOf()

    @OneToMany(mappedBy = "domain", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var boundedContexts: MutableSet<BoundedContext> = mutableSetOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    @Column(name = "business_domain_type", length = 20)
    var type: String? = null

    @Column(name = "vision_statement", columnDefinition = "TEXT")
    var visionStatement: String? = null

    fun addChild(child: BusinessDomain) {
        children.add(child)
        child.parent = this
    }

    fun removeChild(child: BusinessDomain) {
        children.remove(child)
        child.parent = null
    }

    fun getEffectiveType(): String? = type ?: parent?.type

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.first().text

    fun getDescription(locale: String): String = descriptions.find { it.locale == locale }?.text ?: descriptions.first().text
}
