package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ItemCreationRecord

@Repository
interface ItemCreationRecordRepository : JpaRepository<ItemCreationRecord, Long> {
    fun findByReviewedAtIsNull(): List<ItemCreationRecord>

    fun findByResourceTypeAndResourceId(
        resourceType: String,
        resourceId: Long
    ): List<ItemCreationRecord>
}
