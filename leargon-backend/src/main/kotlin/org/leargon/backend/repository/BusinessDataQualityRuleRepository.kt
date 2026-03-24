package org.leargon.backend.repository

import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessDataQualityRule

@Repository
interface BusinessDataQualityRuleRepository : JpaRepository<BusinessDataQualityRule, Long> {
    fun findAllByBusinessEntityKey(key: String): List<BusinessDataQualityRule>

    fun deleteAllByBusinessEntityId(entityId: Long)

    @Query("SELECT r FROM BusinessDataQualityRule r JOIN FETCH r.businessEntity")
    fun findAllWithEntity(): List<BusinessDataQualityRule>
}
