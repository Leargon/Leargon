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
@Table(name = "organisational_units")
class OrganisationalUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @Column(name = "unit_type", length = 20)
    var unitType: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    var lead: User? = null

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

    @ManyToMany
    @JoinTable(
        name = "organisational_unit_parents",
        joinColumns = [JoinColumn(name = "unit_id")],
        inverseJoinColumns = [JoinColumn(name = "parent_id")]
    )
    var parents: MutableSet<OrganisationalUnit> = mutableSetOf()

    @ManyToMany(mappedBy = "parents", fetch = FetchType.LAZY)
    var children: MutableSet<OrganisationalUnit> = mutableSetOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun getName(locale: String): String {
        return names.find { it.locale == locale }?.text ?: names.first().text
    }

    fun getDescription(locale: String): String {
        return descriptions.find { it.locale == locale }?.text ?: descriptions.first().text
    }
}
