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
@Table(name = "classifications")
class Classification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 255)
    var key: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @Column(name = "assignable_to", nullable = false, length = 20)
    var assignableTo: String = ""

    @Column(name = "multi_value", nullable = false)
    var multiValue: Boolean = false

    @Column(name = "is_system", nullable = false)
    var isSystem: Boolean = false

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    var createdBy: User? = null

    @OneToMany(mappedBy = "classification", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    var values: MutableSet<ClassificationValue> = mutableSetOf()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    fun addValue(value: ClassificationValue) {
        values.add(value)
        value.classification = this
    }

    fun removeValue(value: ClassificationValue) {
        values.remove(value)
        value.classification = null
    }

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.first().text
}
