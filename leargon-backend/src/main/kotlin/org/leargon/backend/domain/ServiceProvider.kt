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
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "service_providers")
class ServiceProvider {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", unique = true, nullable = false, length = 200)
    var key: String = ""

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "JSON", nullable = false)
    var names: MutableList<LocalizedText> = mutableListOf()

    @Column(name = "service_provider_type", nullable = false, length = 30)
    var serviceProviderType: String = "DATA_PROCESSOR"

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "processing_countries", columnDefinition = "JSON", nullable = false)
    var processingCountries: MutableList<String> = mutableListOf()

    @Column(name = "processor_agreement_in_place", nullable = false)
    var processorAgreementInPlace: Boolean = false

    @Column(name = "sub_processors_approved", nullable = false)
    var subProcessorsApproved: Boolean = false

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "service_provider_processes",
        joinColumns = [JoinColumn(name = "service_provider_id")],
        inverseJoinColumns = [JoinColumn(name = "process_id")]
    )
    var linkedProcesses: MutableSet<Process> = mutableSetOf()

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now()

    @Column(name = "updated_at")
    var updatedAt: Instant? = null

    fun getName(locale: String): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: key
}
