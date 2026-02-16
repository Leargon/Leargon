package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.serde.annotation.Serdeable
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

import java.time.Instant

@Serdeable
@Entity
@Table(name = "supported_locales")
class SupportedLocale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(name = "locale_code", nullable = false, unique = true, length = 10)
    String localeCode

    @Column(name = "display_name", nullable = false, length = 100)
    String displayName

    @Column(name = "is_default", nullable = false)
    Boolean isDefault = false

    @Column(name = "is_active", nullable = false)
    Boolean isActive = true

    @Column(name = "sort_order", nullable = false)
    Integer sortOrder = 0

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt
}
