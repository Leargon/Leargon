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

    /** Explicit accountable owner; when unset, ownership is inherited (see [effectiveOwner]). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    var owner: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "LONGTEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "LONGTEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @OneToMany(mappedBy = "businessDomain", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var versions: MutableSet<BusinessDomainVersion> = mutableSetOf()

    @OneToMany(mappedBy = "domain", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var boundedContexts: MutableSet<BoundedContext> = mutableSetOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "LONGTEXT")
    var classificationAssignments: MutableList<ClassificationAssignment> = mutableListOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    @Column(name = "business_domain_type", length = 20)
    var type: String? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vision_statement", columnDefinition = "LONGTEXT")
    var visionStatement: MutableList<LocalizedText> = mutableListOf()

    fun addChild(child: BusinessDomain) {
        children.add(child)
        child.parent = this
    }

    fun removeChild(child: BusinessDomain) {
        children.remove(child)
        child.parent = null
    }

    fun getEffectiveType(): String? = type ?: parent?.type

    /** This domain followed by its ancestors, nearest first (cycle-guarded). */
    fun selfAndAncestors(): List<BusinessDomain> {
        val chain = mutableListOf<BusinessDomain>()
        var current: BusinessDomain? = this
        while (current != null && chain.none { it === current }) {
            chain.add(current)
            current = current.parent
        }
        return chain
    }

    /**
     * The accountable owner: the explicit [owner], else the owning unit's business owner, else the
     * parent domain's effective owner (walked up the domain tree).
     */
    fun effectiveOwner(): User? = selfAndAncestors().firstNotNullOfOrNull { it.owner ?: it.owningUnit?.businessOwner }

    /** Domains carry no steward person: the owning unit's steward, inherited up the domain tree. */
    fun effectiveSteward(): User? = selfAndAncestors().firstNotNullOfOrNull { it.owningUnit?.businessSteward }

    /** The owning unit, inherited up the domain tree. */
    fun effectiveOwningUnit(): OrganisationalUnit? = selfAndAncestors().firstNotNullOfOrNull { it.owningUnit }

    /**
     * Everyone whose realm contains this domain: the effective owner of this domain and of every
     * ancestor domain. A parent-domain owner keeps creation rights in a subdomain that has its own owner.
     */
    fun realmOwners(): List<User> = selfAndAncestors().mapNotNull { it.effectiveOwner() }.distinctBy { it.id }

    fun getName(locale: String): String = names.textForLocale(locale, key)

    fun getDescription(locale: String): String = descriptions.textForLocale(locale, "")
}
