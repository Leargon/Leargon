package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import io.micronaut.serde.annotation.Serdeable
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

@Serdeable
@Entity
@Table(name = "organisational_units")
class OrganisationalUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    String key

    @Column(name = "unit_type", length = 20)
    String unitType

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id")
    User lead

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    User createdBy

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    List<LocalizedText> names = new ArrayList<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    List<LocalizedText> descriptions = new ArrayList<>()

    @ManyToMany
    @JoinTable(
            name = "organisational_unit_parents",
            joinColumns = @JoinColumn(name = "unit_id"),
            inverseJoinColumns = @JoinColumn(name = "parent_id"))
    Set<OrganisationalUnit> parents = new HashSet<>()

    @ManyToMany(mappedBy = "parents", fetch = FetchType.LAZY)
    Set<OrganisationalUnit> children = new HashSet<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    String getName(String locale) {
        def text = names.find { it.locale == locale }
        return text ? text.text : names.first().text
    }

    String getDescription(String locale) {
        def text = descriptions.find { it.locale == locale }
        return text ? text.text : descriptions.first().text
    }
}
