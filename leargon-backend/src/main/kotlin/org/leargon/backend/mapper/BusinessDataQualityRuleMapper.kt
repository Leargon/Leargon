package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDataQualityRule
import org.leargon.backend.model.BusinessDataQualityRuleResponse
import org.leargon.backend.model.BusinessDataQualityRuleResponseSeverity
import java.time.ZoneOffset

@Singleton
class BusinessDataQualityRuleMapper {
    fun toResponse(rule: BusinessDataQualityRule): BusinessDataQualityRuleResponse =
        BusinessDataQualityRuleResponse(
            rule.id!!,
            rule.description,
            rule.createdAt.atZone(ZoneOffset.UTC),
        ).severity(rule.severity?.let { BusinessDataQualityRuleResponseSeverity.fromValue(it) })
            .updatedAt(rule.updatedAt?.atZone(ZoneOffset.UTC))
}
