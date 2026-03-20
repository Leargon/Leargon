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
@Table(name = "business_entity_relationships")
class BusinessEntityRelationship {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "first_business_entity_id", nullable = false)
    var firstBusinessEntity: BusinessEntity? = null

    @Column(name = "first_cardinality_minimum", nullable = false)
    var firstCardinalityMinimum: Int = 0

    @Column(name = "first_cardinality_maximum")
    var firstCardinalityMaximum: Int? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "second_business_entity_id", nullable = false)
    var secondBusinessEntity: BusinessEntity? = null

    @Column(name = "second_cardinality_minimum", nullable = false)
    var secondCardinalityMinimum: Int = 0

    @Column(name = "second_cardinality_maximum")
    var secondCardinalityMaximum: Int? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun swapped(): BusinessEntityRelationship {
        val swapped = BusinessEntityRelationship()
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
