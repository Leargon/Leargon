package org.leargon.backend.domain

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
@Table(name = "business_data_quality_rules")
class BusinessDataQualityRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_entity_id", nullable = false)
    var businessEntity: BusinessEntity? = null

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description", columnDefinition = "LONGTEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @Column(name = "severity", length = 10)
    var severity: String? = null

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now()

    @Column(name = "updated_at")
    var updatedAt: Instant? = null
}
