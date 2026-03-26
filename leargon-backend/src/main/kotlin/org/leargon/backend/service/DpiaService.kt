package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.Dpia
import org.leargon.backend.domain.User
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.DpiaMapper
import org.leargon.backend.model.DpiaListItemResponse
import org.leargon.backend.model.DpiaResponse
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import java.time.LocalDate
import java.util.UUID

@Singleton
open class DpiaService(
    private val dpiaRepository: DpiaRepository,
    private val processRepository: ProcessRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val dpiaMapper: DpiaMapper
) {
    @Transactional
    open fun triggerForProcess(
        processKey: String,
        currentUser: User
    ): DpiaResponse {
        val process =
            processRepository
                .findByKey(processKey)
                .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }
        process.id?.let { pid ->
            if (dpiaRepository.findByProcessId(pid).isPresent) {
                throw DuplicateResourceException("A DPIA already exists for process: $processKey")
            }
        }
        val dpia =
            Dpia().apply {
                key = "dpia-${UUID.randomUUID()}"
                status = "IN_PROGRESS"
                this.process = process
                triggeredBy = currentUser
            }
        val saved = dpiaRepository.save(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(saved.key).get())
    }

    @Transactional
    open fun triggerForEntity(
        entityKey: String,
        currentUser: User
    ): DpiaResponse {
        val entity =
            businessEntityRepository
                .findByKey(entityKey)
                .orElseThrow { ResourceNotFoundException("Entity not found: $entityKey") }
        entity.id?.let { eid ->
            if (dpiaRepository.findByEntityId(eid).isPresent) {
                throw DuplicateResourceException("A DPIA already exists for entity: $entityKey")
            }
        }
        val dpia =
            Dpia().apply {
                key = "dpia-${UUID.randomUUID()}"
                status = "IN_PROGRESS"
                this.entity = entity
                triggeredBy = currentUser
            }
        val saved = dpiaRepository.save(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(saved.key).get())
    }

    fun getDpiaForProcess(processKey: String): DpiaResponse {
        val process =
            processRepository
                .findByKey(processKey)
                .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }
        val dpia =
            process.id
                ?.let { dpiaRepository.findByProcessId(it) }
                ?.orElseThrow { ResourceNotFoundException("No DPIA found for process: $processKey") }
                ?: throw ResourceNotFoundException("No DPIA found for process: $processKey")
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpia)
    }

    fun getDpiaForEntity(entityKey: String): DpiaResponse {
        val entity =
            businessEntityRepository
                .findByKey(entityKey)
                .orElseThrow { ResourceNotFoundException("Entity not found: $entityKey") }
        val dpia =
            entity.id
                ?.let { dpiaRepository.findByEntityId(it) }
                ?.orElseThrow { ResourceNotFoundException("No DPIA found for entity: $entityKey") }
                ?: throw ResourceNotFoundException("No DPIA found for entity: $entityKey")
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpia)
    }

    @Transactional
    open fun updateRiskDescription(
        dpiaKey: String,
        riskDescription: String?,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        dpia.riskDescription = riskDescription
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    @Transactional
    open fun updateMeasures(
        dpiaKey: String,
        measures: String?,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        dpia.measures = measures
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    @Transactional
    open fun updateResidualRisk(
        dpiaKey: String,
        initialRisk: String?,
        residualRisk: String?,
        fdpicConsultationRequired: Boolean?,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        if (initialRisk != null) dpia.initialRisk = initialRisk
        dpia.residualRisk = residualRisk
        if (fdpicConsultationRequired != null) {
            dpia.fdpicConsultationRequired = fdpicConsultationRequired
        }
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    @Transactional
    open fun complete(
        dpiaKey: String,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        dpia.status = "COMPLETED"
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    @Transactional
    open fun reopen(
        dpiaKey: String,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        dpia.status = "IN_PROGRESS"
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    @Transactional
    open fun updateFdpicConsultation(
        dpiaKey: String,
        completed: Boolean?,
        date: LocalDate?,
        outcome: String?,
        currentUser: User
    ): DpiaResponse {
        val dpia = getDpiaByKey(dpiaKey)
        checkEditPermission(dpia, currentUser)
        if (completed != null) dpia.fdpicConsultationCompleted = completed
        if (date != null) dpia.fdpicConsultationDate = date
        if (outcome != null) dpia.fdpicConsultationOutcome = outcome
        dpiaRepository.update(dpia)
        val mapper = dpiaMapper
        return mapper.toDpiaResponse(dpiaRepository.findByKey(dpia.key).get())
    }

    fun getAllDpias(): List<DpiaListItemResponse> {
        val mapper = dpiaMapper
        return dpiaRepository.findAll().map { mapper.toDpiaListItemResponse(it) }
    }

    private fun getDpiaByKey(key: String): Dpia =
        dpiaRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("DPIA not found: $key") }

    private fun checkEditPermission(
        dpia: Dpia,
        currentUser: User
    ) {
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        val isTriggeredBy = dpia.triggeredBy?.id == currentUser.id
        if (!isAdmin && !isTriggeredBy) {
            throw ForbiddenOperationException("Only the user who triggered the DPIA or an admin can edit it")
        }
    }
}
