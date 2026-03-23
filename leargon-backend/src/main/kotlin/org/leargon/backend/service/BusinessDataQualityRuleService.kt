package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessDataQualityRule
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BusinessDataQualityRuleMapper
import org.leargon.backend.model.BusinessDataQualityRuleResponse
import org.leargon.backend.model.CreateBusinessDataQualityRuleRequest
import org.leargon.backend.model.UpdateBusinessDataQualityRuleRequest
import org.leargon.backend.repository.BusinessDataQualityRuleRepository
import org.leargon.backend.repository.BusinessEntityRepository
import java.time.Instant

@Singleton
open class BusinessDataQualityRuleService(
    private val ruleRepository: BusinessDataQualityRuleRepository,
    private val entityRepository: BusinessEntityRepository,
    private val mapper: BusinessDataQualityRuleMapper
) {
    @Transactional
    open fun getRulesForEntity(entityKey: String): List<BusinessDataQualityRuleResponse> {
        val entityRepo = this.entityRepository
        entityRepo.findByKey(entityKey).orElseThrow {
            ResourceNotFoundException("Business entity not found: $entityKey")
        }
        val repo = this.ruleRepository
        val m = this.mapper
        return repo.findAllByBusinessEntityKey(entityKey).map { m.toResponse(it) }
    }

    @Transactional
    open fun create(
        entityKey: String,
        request: CreateBusinessDataQualityRuleRequest,
        currentUser: User
    ): BusinessDataQualityRuleResponse {
        val entity =
            entityRepository.findByKey(entityKey).orElseThrow {
                ResourceNotFoundException("Business entity not found: $entityKey")
            }
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        if (!isAdmin && entity.dataOwner?.id != currentUser.id) {
            throw ForbiddenOperationException("Only the data owner or an admin can add quality rules")
        }
        val m = this.mapper
        val rule =
            BusinessDataQualityRule().apply {
                businessEntity = entity
                description = request.description
                severity = request.severity?.value
            }
        val repo = this.ruleRepository
        repo.save(rule)
        return m.toResponse(rule)
    }

    @Transactional
    open fun update(
        entityKey: String,
        ruleId: Long,
        request: UpdateBusinessDataQualityRuleRequest,
        currentUser: User
    ): BusinessDataQualityRuleResponse {
        val entity =
            entityRepository.findByKey(entityKey).orElseThrow {
                ResourceNotFoundException("Business entity not found: $entityKey")
            }
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        if (!isAdmin && entity.dataOwner?.id != currentUser.id) {
            throw ForbiddenOperationException("Only the data owner or an admin can edit quality rules")
        }
        val repo = this.ruleRepository
        val rule =
            repo.findById(ruleId).orElseThrow {
                ResourceNotFoundException("Quality rule not found: $ruleId")
            }
        val m = this.mapper
        rule.description = request.description
        rule.severity = request.severity?.value
        rule.updatedAt = Instant.now()
        repo.update(rule)
        return m.toResponse(rule)
    }

    @Transactional
    open fun delete(
        entityKey: String,
        ruleId: Long,
        currentUser: User
    ) {
        val entityRepo = this.entityRepository
        val entity =
            entityRepo.findByKey(entityKey).orElseThrow {
                ResourceNotFoundException("Business entity not found: $entityKey")
            }
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        if (!isAdmin && entity.dataOwner?.id != currentUser.id) {
            throw ForbiddenOperationException("Only the data owner or an admin can delete quality rules")
        }
        val removed = entity.qualityRules.removeIf { it.id == ruleId }
        if (!removed) {
            throw ResourceNotFoundException("Quality rule not found: $ruleId")
        }
        entityRepo.update(entity)
    }

    @Transactional
    open fun getAllRules(): List<BusinessDataQualityRule> = ruleRepository.findAllWithEntity()
}
