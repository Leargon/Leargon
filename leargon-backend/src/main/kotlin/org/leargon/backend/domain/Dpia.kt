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
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "dpia")
class Dpia {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    var key: String = ""

    @Column(name = "status", nullable = false, length = 20)
    var status: String = "IN_PROGRESS"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_id")
    var process: Process? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entity_id")
    var entity: BusinessEntity? = null

    @Column(name = "risk_description", columnDefinition = "TEXT")
    var riskDescription: String? = null

    @Column(name = "measures", columnDefinition = "TEXT")
    var measures: String? = null

    @Column(name = "initial_risk", length = 10)
    var initialRisk: String? = null

    @Column(name = "residual_risk", length = 10)
    var residualRisk: String? = null

    @Column(name = "fdpic_consultation_required")
    var fdpicConsultationRequired: Boolean? = null

    @Column(name = "fdpic_consultation_completed")
    var fdpicConsultationCompleted: Boolean? = null

    @Column(name = "fdpic_consultation_date")
    var fdpicConsultationDate: LocalDate? = null

    @Column(name = "fdpic_consultation_outcome", columnDefinition = "TEXT")
    var fdpicConsultationOutcome: String? = null

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "triggered_by_id")
    var triggeredBy: User? = null

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null
}
