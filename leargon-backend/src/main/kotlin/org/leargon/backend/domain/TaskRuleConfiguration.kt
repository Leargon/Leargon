package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/**
 * Organisation-wide configuration of a single governance to-do rule.
 *
 * A rule with no row falls back to its definition default (BASIC-tier rules are on, everything else
 * off), so a fresh installation starts with a short, achievable list. [priority] overrides the rule's
 * default priority, letting an organisation keep a rule visible as "could do" instead of losing it.
 */
@Entity
@Table(
    name = "task_rule_configurations",
    uniqueConstraints = [UniqueConstraint(name = "uq_task_rule_config_code", columnNames = ["rule_code"])]
)
class TaskRuleConfiguration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "rule_code", nullable = false, length = 60)
    var ruleCode: String = ""

    @Column(name = "enabled", nullable = false)
    var enabled: Boolean = true

    /** REQUIRED or RECOMMENDED; null keeps the rule's default priority. */
    @Column(name = "priority", length = 15)
    var priority: String? = null
}
