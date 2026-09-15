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
@Table(name = "bounded_contexts")
class BoundedContext {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "domain_id", nullable = false)
    var domain: BusinessDomain? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "LONGTEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "LONGTEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @Column(name = "context_type", length = 20)
    var contextType: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_unit_id")
    var owningUnit: OrganisationalUnit? = null

    /** Explicit owner; when unset, ownership is inherited (see [effectiveOwner]). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    var owner: User? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    var createdBy: User? = null

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    /** The explicit [owner], else the owning team's business owner, else the domain's effective owner. */
    fun effectiveOwner(): User? = owner ?: owningUnit?.businessOwner ?: domain?.effectiveOwner()

    /** Bounded contexts carry no steward person: the owning team's steward, else the domain's. */
    fun effectiveSteward(): User? = owningUnit?.businessSteward ?: domain?.effectiveSteward()

    fun effectiveOwningUnit(): OrganisationalUnit? = owningUnit ?: domain?.effectiveOwningUnit()

    /** Everyone whose realm contains this bounded context: its effective owner plus the domain realm. */
    fun realmOwners(): List<User> = (listOfNotNull(effectiveOwner()) + domain?.realmOwners().orEmpty()).distinctBy { it.id }

    fun getName(locale: String): String = names.textForLocale(locale, key)
}
