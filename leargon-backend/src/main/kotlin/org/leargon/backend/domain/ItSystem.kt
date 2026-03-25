package org.leargon.backend.domain

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

@Entity
@Table(name = "it_systems")
class ItSystem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", unique = true, nullable = false, length = 200)
    var key: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "TEXT", nullable = false)
    var names: MutableList<LocalizedText> = mutableListOf()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "TEXT", nullable = false)
    var descriptions: MutableList<LocalizedText> = mutableListOf()

    @Column(name = "vendor", length = 500)
    var vendor: String? = null

    @Column(name = "system_url", length = 1000)
    var systemUrl: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owning_unit_id")
    var owningUnit: OrganisationalUnit? = null

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "it_system_processes",
        joinColumns = [JoinColumn(name = "it_system_id")],
        inverseJoinColumns = [JoinColumn(name = "process_id")]
    )
    var linkedProcesses: MutableSet<Process> = mutableSetOf()

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now()

    @Column(name = "updated_at")
    var updatedAt: Instant? = null

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: key
}
