package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "field_configurations")
class FieldConfiguration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "entity_type", nullable = false, length = 30)
    var entityType: String = ""

    @Column(name = "field_name", nullable = false, length = 100)
    var fieldName: String = ""
}
