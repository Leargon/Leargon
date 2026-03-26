package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(nullable = false, unique = true)
    var email: String = ""

    @Column(nullable = false, unique = true, length = 100)
    var username: String = ""

    @Column(name = "password_hash")
    var passwordHash: String? = null

    @Column(name = "first_name", length = 100)
    var firstName: String? = null

    @Column(name = "last_name", length = 100)
    var lastName: String? = null

    @Column(name = "preferred_language", length = 10)
    var preferredLanguage: String? = null

    @Column(nullable = false)
    var enabled: Boolean = true

    @Column(nullable = false, length = 255)
    var roles: String = "ROLE_USER"

    @Column(name = "is_fallback_administrator", nullable = false)
    var isFallbackAdministrator: Boolean = false

    @Column(name = "setup_completed", nullable = false)
    var setupCompleted: Boolean = false

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    @Column(name = "last_login_at")
    var lastLoginAt: Instant? = null

    @Column(name = "azure_oid", unique = true, length = 36)
    var azureOid: String? = null

    @Column(name = "auth_provider", length = 20)
    var authProvider: String? = null

    @Column(name = "preferred_role", length = 20)
    var preferredRole: String? = null
}
