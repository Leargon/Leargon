package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.FieldVerification
import org.leargon.backend.domain.User
import org.leargon.backend.repository.FieldVerificationRepository

/**
 * Central logic for per-field verification status. Status is value-based: each row stores the
 * last-known normalized value, and a field only changes status when its value actually changes.
 *
 * Who edits decides the new status of a changed field:
 *  - owner edits  → VERIFIED (the edit is itself the act of verification)
 *  - non-owner    → UNVERIFIED (the owner is prompted to re-confirm)
 *
 * See [setStatus] for the explicit owner-only verify/reset action.
 */
@Singleton
open class FieldVerificationService(
    private val fieldVerificationRepository: FieldVerificationRepository,
    private val fieldConfigurationService: FieldConfigurationService
) {
    companion object {
        const val VERIFIED = "VERIFIED"
        const val UNVERIFIED = "UNVERIFIED"
    }

    @Transactional
    open fun getStatuses(
        entityType: String,
        entityId: Long
    ): List<FieldVerification> = fieldVerificationRepository.findByEntityTypeAndEntityId(entityType, entityId)

    /**
     * Reconciles the stored verification rows against the entity's current field values.
     * [valueOf] returns the normalized value of a concrete field name, or null when absent/not tracked.
     */
    @Transactional
    open fun sync(
        entityType: String,
        entityId: Long,
        actor: User,
        actorIsOwner: Boolean,
        valueOf: (String) -> String?
    ) {
        val repo = this.fieldVerificationRepository
        val newStatus = if (actorIsOwner) VERIFIED else UNVERIFIED

        val fieldNames = fieldConfigurationService.concreteFieldNames(entityType)
        val currentValues = fieldNames.mapNotNull { fn -> valueOf(fn)?.let { fn to it } }.toMap()
        val existing = repo.findByEntityTypeAndEntityId(entityType, entityId).associateBy { it.fieldName }

        // Upsert fields that currently have a value.
        currentValues.forEach { (fieldName, value) ->
            val row = existing[fieldName]
            when {
                row == null ->
                    repo.save(
                        FieldVerification().apply {
                            this.entityType = entityType
                            this.entityId = entityId
                            this.fieldName = fieldName
                            this.status = newStatus
                            this.lastValue = value
                            this.updatedBy = actor
                            this.updatedByUsername = actor.username
                        }
                    )

                row.lastValue != value -> {
                    row.status = newStatus
                    row.lastValue = value
                    row.updatedBy = actor
                    row.updatedByUsername = actor.username
                    repo.update(row)
                }
                // unchanged value → preserve prior status / verifier / timestamp
            }
        }

        // Detect cleared fields: a tracked row whose field no longer has a value.
        existing.values.forEach { row ->
            if (row.fieldName !in currentValues && row.lastValue != null) {
                row.status = newStatus
                row.lastValue = null
                row.updatedBy = actor
                row.updatedByUsername = actor.username
                repo.update(row)
            }
        }
    }

    /**
     * Explicitly sets the status of a single field (owner-only verify or reset). [currentValue] keeps
     * the stored snapshot consistent so a subsequent identical save does not re-flip the status.
     */
    @Transactional
    open fun setStatus(
        entityType: String,
        entityId: Long,
        fieldName: String,
        status: String,
        owner: User,
        currentValue: String?
    ): FieldVerification {
        val repo = this.fieldVerificationRepository
        val existing = repo.findByEntityTypeAndEntityIdAndFieldName(entityType, entityId, fieldName)
        val row =
            existing.orElseGet {
                FieldVerification().apply {
                    this.entityType = entityType
                    this.entityId = entityId
                    this.fieldName = fieldName
                }
            }
        row.status = status
        row.lastValue = currentValue
        row.updatedBy = owner
        row.updatedByUsername = owner.username
        return if (row.id == null) repo.save(row) else repo.update(row)
    }

    @Transactional
    open fun deleteFor(
        entityType: String,
        entityId: Long
    ) = fieldVerificationRepository.deleteByEntityTypeAndEntityId(entityType, entityId)

    /**
     * One-time backfill: seeds an UNVERIFIED row (attributed to "system", no user) for each present
     * field that has no row yet, so existing records surface verification indicators immediately and
     * the owner can verify them. Only fills gaps — never disturbs existing rows. Idempotent.
     */
    @Transactional
    open fun backfillUnverified(
        entityType: String,
        entityId: Long,
        valueOf: (String) -> String?
    ) {
        val repo = this.fieldVerificationRepository
        val existing = repo.findByEntityTypeAndEntityId(entityType, entityId).map { it.fieldName }.toSet()
        fieldConfigurationService.concreteFieldNames(entityType).forEach { fieldName ->
            if (fieldName in existing) return@forEach
            val value = valueOf(fieldName) ?: return@forEach
            repo.save(
                FieldVerification().apply {
                    this.entityType = entityType
                    this.entityId = entityId
                    this.fieldName = fieldName
                    this.status = UNVERIFIED
                    this.lastValue = value
                    this.updatedBy = null
                    this.updatedByUsername = "system"
                }
            )
        }
    }
}
