package org.leargon.backend.service

import io.micronaut.transaction.annotation.Transactional
import jakarta.inject.Singleton
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ItSystemMapper
import org.leargon.backend.model.CreateItSystemRequest
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.UpdateItSystemLinkedProcessesRequest
import org.leargon.backend.model.UpdateItSystemRequest
import org.leargon.backend.model.UpdateProcessItSystemsRequest
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.ProcessRepository
import java.time.Instant

@Singleton
open class ItSystemService(
    private val itSystemRepository: ItSystemRepository,
    private val processRepository: ProcessRepository,
    private val itSystemMapper: ItSystemMapper
) {
    @Transactional
    open fun getAll(): List<ItSystemResponse> {
        val mapper = itSystemMapper
        return itSystemRepository.findAll().map { mapper.toItSystemResponse(it) }
    }

    @Transactional
    open fun getByKey(key: String): ItSystemResponse {
        val itSystem =
            itSystemRepository.findByKey(key)
                ?: throw ResourceNotFoundException("IT system not found: $key")
        return itSystemMapper.toItSystemResponse(itSystem)
    }

    @Transactional
    open fun create(request: CreateItSystemRequest): ItSystemResponse {
        val slug =
            request.names.find { it.locale == "en" }?.text
                ?: request.names.first().text
        val key = slug.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
        if (itSystemRepository.existsByKey(key)) {
            throw DuplicateResourceException("IT system with key '$key' already exists")
        }
        val itSystem =
            ItSystem().apply {
                this.key = key
                this.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
                this.descriptions = (request.descriptions ?: emptyList()).map { LocalizedText(it.locale, it.text) }.toMutableList()
                this.vendor = request.vendor
                this.systemUrl = request.systemUrl
            }
        itSystemRepository.save(itSystem)
        return itSystemMapper.toItSystemResponse(itSystem)
    }

    @Transactional
    open fun update(
        key: String,
        request: UpdateItSystemRequest
    ): ItSystemResponse {
        val itSystem =
            itSystemRepository.findByKey(key)
                ?: throw ResourceNotFoundException("IT system not found: $key")
        itSystem.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        itSystem.descriptions = (request.descriptions ?: emptyList()).map { LocalizedText(it.locale, it.text) }.toMutableList()
        itSystem.vendor = request.vendor
        itSystem.systemUrl = request.systemUrl
        itSystem.updatedAt = Instant.now()
        itSystemRepository.update(itSystem)
        return itSystemMapper.toItSystemResponse(itSystem)
    }

    @Transactional
    open fun delete(key: String) {
        val itSystem =
            itSystemRepository.findByKey(key)
                ?: throw ResourceNotFoundException("IT system not found: $key")
        itSystemRepository.delete(itSystem)
    }

    @Transactional
    open fun updateLinkedProcesses(
        key: String,
        request: UpdateItSystemLinkedProcessesRequest
    ) {
        val itSystem =
            itSystemRepository.findByKey(key)
                ?: throw ResourceNotFoundException("IT system not found: $key")
        val processes = request.processKeys.mapNotNull { processRepository.findByKey(it).orElse(null) }.toMutableSet()
        itSystem.linkedProcesses = processes
        itSystem.updatedAt = Instant.now()
        itSystemRepository.update(itSystem)
    }

    @Transactional
    open fun updateProcessItSystems(
        processKey: String,
        request: UpdateProcessItSystemsRequest
    ) {
        val process =
            processRepository.findByKey(processKey).orElseThrow {
                ResourceNotFoundException("Process not found: $processKey")
            }

        // Process.itSystems is the inverse side of the ManyToMany (mappedBy = "linkedProcesses").
        // Persisting requires updating the owning side: ItSystem.linkedProcesses.
        val currentOwners = itSystemRepository.findByLinkedProcessesKey(processKey)
        currentOwners.forEach { itSystem ->
            itSystem.linkedProcesses.removeIf { it.key == processKey }
            itSystemRepository.update(itSystem)
        }

        val newItSystems = request.itSystemKeys.mapNotNull { itSystemRepository.findByKey(it) }
        newItSystems.forEach { itSystem ->
            itSystem.linkedProcesses.add(process)
            itSystemRepository.update(itSystem)
        }
    }
}
