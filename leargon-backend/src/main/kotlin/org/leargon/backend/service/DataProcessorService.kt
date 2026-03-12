package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.DataProcessor
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.DataProcessorMapper
import org.leargon.backend.model.CreateDataProcessorRequest
import org.leargon.backend.model.DataProcessorResponse
import org.leargon.backend.model.UpdateDataProcessorRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.DataProcessorRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.util.SlugUtil
import java.time.Instant

@Singleton
open class DataProcessorService(
    private val dataProcessorRepository: DataProcessorRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val dataProcessorMapper: DataProcessorMapper,
    private val localeService: LocaleService
) {

    @Transactional
    open fun getAll(): List<DataProcessorResponse> {
        val mapper = dataProcessorMapper
        return dataProcessorRepository.findAll().map { mapper.toDataProcessorResponse(it) }
    }

    @Transactional
    open fun getByKey(key: String): DataProcessorResponse {
        val dp = dataProcessorRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("DataProcessor not found: $key") }
        val mapper = dataProcessorMapper
        return mapper.toDataProcessorResponse(dp)
    }

    @Transactional
    open fun create(request: CreateDataProcessorRequest): DataProcessorResponse {
        val dp = DataProcessor()
        dp.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        dp.processingCountries = (request.processingCountries ?: emptyList()).toMutableList()
        dp.processorAgreementInPlace = request.processorAgreementInPlace ?: false
        dp.subProcessorsApproved = request.subProcessorsApproved ?: false

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = dp.names.find { it.locale == defaultLocale?.localeCode }?.text
            ?: dp.names.firstOrNull()?.text
        val slug = SlugUtil.slugify(defaultName)

        if (dataProcessorRepository.existsByKey(slug)) {
            throw DuplicateResourceException("DataProcessor with key '$slug' already exists")
        }
        dp.key = slug

        val saved = dataProcessorRepository.save(dp)
        return dataProcessorMapper.toDataProcessorResponse(saved)
    }

    @Transactional
    open fun update(key: String, request: UpdateDataProcessorRequest): DataProcessorResponse {
        val dp = dataProcessorRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("DataProcessor not found: $key") }

        dp.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        dp.processingCountries = (request.processingCountries ?: emptyList()).toMutableList()
        dp.processorAgreementInPlace = request.processorAgreementInPlace ?: false
        dp.subProcessorsApproved = request.subProcessorsApproved ?: false
        dp.updatedAt = Instant.now()

        val updated = dataProcessorRepository.update(dp)
        return dataProcessorRepository.findByKey(updated.key)
            .map { dataProcessorMapper.toDataProcessorResponse(it) }
            .orElseThrow { ResourceNotFoundException("DataProcessor not found after update: $key") }
    }

    @Transactional
    open fun delete(key: String) {
        val dp = dataProcessorRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("DataProcessor not found: $key") }
        dataProcessorRepository.delete(dp)
    }

    @Transactional
    open fun updateLinkedEntities(key: String, entityKeys: List<String>) {
        val dp = dataProcessorRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("DataProcessor not found: $key") }

        val newEntities = entityKeys.map { entityKey ->
            businessEntityRepository.findByKey(entityKey)
                .orElseThrow { ResourceNotFoundException("BusinessEntity not found: $entityKey") }
        }

        dp.linkedBusinessEntities.clear()
        dp.linkedBusinessEntities.addAll(newEntities)
        dataProcessorRepository.update(dp)
    }

    @Transactional
    open fun updateLinkedProcesses(key: String, processKeys: List<String>) {
        val dp = dataProcessorRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("DataProcessor not found: $key") }

        val newProcesses = processKeys.map { processKey ->
            processRepository.findByKey(processKey)
                .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }
        }

        dp.linkedProcesses.clear()
        dp.linkedProcesses.addAll(newProcesses)
        dataProcessorRepository.update(dp)
    }

    @Transactional
    open fun updateEntityDataProcessors(entityKey: String, dpKeys: List<String>) {
        val entity = businessEntityRepository.findByKey(entityKey)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found: $entityKey") }

        val desired = dpKeys.map { dpKey ->
            dataProcessorRepository.findByKey(dpKey)
                .orElseThrow { ResourceNotFoundException("DataProcessor not found: $dpKey") }
        }.toSet()

        val current = dataProcessorRepository.findByLinkedBusinessEntitiesKey(entityKey)
        current.forEach { dp ->
            dp.linkedBusinessEntities.remove(entity)
            dataProcessorRepository.update(dp)
        }
        desired.forEach { dp ->
            dp.linkedBusinessEntities.add(entity)
            dataProcessorRepository.update(dp)
        }
    }

    @Transactional
    open fun updateProcessDataProcessors(processKey: String, dpKeys: List<String>) {
        val process = processRepository.findByKey(processKey)
            .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }

        val desired = dpKeys.map { dpKey ->
            dataProcessorRepository.findByKey(dpKey)
                .orElseThrow { ResourceNotFoundException("DataProcessor not found: $dpKey") }
        }.toSet()

        val current = dataProcessorRepository.findByLinkedProcessesKey(processKey)
        current.forEach { dp ->
            dp.linkedProcesses.remove(process)
            dataProcessorRepository.update(dp)
        }
        desired.forEach { dp ->
            dp.linkedProcesses.add(process)
            dataProcessorRepository.update(dp)
        }
    }
}
