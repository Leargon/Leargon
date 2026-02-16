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
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

import java.time.Instant

@Serdeable
@Entity
@Table(name = "business_entity_relationships")
class BusinessEntityRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "first_business_entity_id", nullable = false)
    BusinessEntity firstBusinessEntity

    @Column(name = "first_cardinality_minimum", nullable = false)
    int firstCardinalityMinimum

    @Column(name = "first_cardinality_maximum")
    Integer firstCardinalityMaximum

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "second_business_entity_id", nullable = false)
    BusinessEntity secondBusinessEntity

    @Column(name = "second_cardinality_minimum", nullable = false)
    int secondCardinalityMinimum

    @Column(name = "second_cardinality_maximum")
    Integer secondCardinalityMaximum

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    List<LocalizedText> descriptions = new ArrayList<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    BusinessEntityRelationship swapped() {
        BusinessEntityRelationship swapped = new BusinessEntityRelationship()
        swapped.id = this.id
        swapped.firstBusinessEntity = this.secondBusinessEntity
        swapped.firstCardinalityMinimum = this.secondCardinalityMinimum
        swapped.firstCardinalityMaximum = this.secondCardinalityMaximum
        swapped.secondBusinessEntity = this.firstBusinessEntity
        swapped.secondCardinalityMinimum = this.firstCardinalityMinimum
        swapped.secondCardinalityMaximum = this.firstCardinalityMaximum
        swapped.descriptions = this.descriptions
        swapped.createdAt = this.createdAt
        swapped.updatedAt = this.updatedAt
        return swapped
    }
}
