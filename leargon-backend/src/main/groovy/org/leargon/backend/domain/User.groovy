package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
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
@Table(name = "users")
class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(nullable = false, unique = true)
    String email

    @Column(nullable = false, unique = true, length = 100)
    String username

    @Column(name = "password_hash")
    String passwordHash

    @Column(name = "first_name", length = 100)
    String firstName

    @Column(name = "last_name", length = 100)
    String lastName

    @Column(name = "preferred_language", length = 10)
    String preferredLanguage

    @Column(nullable = false)
    Boolean enabled = true

    @Column(name = "account_locked", nullable = false)
    Boolean accountLocked = false

    @Column(name = "account_expired", nullable = false)
    Boolean accountExpired = false

    @Column(name = "password_expired", nullable = false)
    Boolean passwordExpired = false

    @Column(nullable = false, length = 255)
    String roles = "ROLE_USER"

    @Column(name = "is_fallback_administrator", nullable = false)
    Boolean isFallbackAdministrator = false

    @Column(name = "setup_completed", nullable = false)
    Boolean setupCompleted = false

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    @Column(name = "last_login_at")
    Instant lastLoginAt

    @Column(name = "azure_oid", unique = true, length = 36)
    String azureOid

    @Column(name = "auth_provider", length = 20)
    String authProvider
}
