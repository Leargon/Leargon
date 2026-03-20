package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "supported_locales")
class SupportedLocale {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "locale_code", nullable = false, unique = true, length = 10)
    var localeCode: String = ""

    @Column(name = "display_name", length = 100)
    var displayName: String? = null

    @Column(name = "is_default", nullable = false)
    var isDefault: Boolean = false

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null
}
