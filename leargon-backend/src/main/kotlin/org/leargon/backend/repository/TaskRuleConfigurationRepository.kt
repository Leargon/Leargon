package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.TaskRuleConfiguration
import java.util.Optional

@Repository
interface TaskRuleConfigurationRepository : JpaRepository<TaskRuleConfiguration, Long> {
    fun findByRuleCode(ruleCode: String): Optional<TaskRuleConfiguration>
}
