package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.Capability
import org.leargon.backend.domain.ClassificationAssignment
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.CapabilityMapper
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.CreateCapabilityRequest
import org.leargon.backend.model.UpdateCapabilityRequest
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.util.SlugUtil
import java.time.Instant

@Singleton
open class CapabilityService(
    private val capabilityRepository: CapabilityRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val classificationRepository: ClassificationRepository,
    private val capabilityMapper: CapabilityMapper,
    private val localeService: LocaleService
) {
    @Transactional
    open fun getAll(): List<CapabilityResponse> {
        val mapper = capabilityMapper
        return capabilityRepository.findAll().map { mapper.toCapabilityResponse(it) }
    }

    @Transactional
    open fun getByKey(key: String): CapabilityResponse {
        val capability =
            capabilityRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("Capability not found: $key") }
        return capabilityMapper.toCapabilityResponse(capability)
    }

    @Transactional
    open fun create(request: CreateCapabilityRequest): CapabilityResponse {
        val capability = Capability()
        capability.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        capability.descriptions = request.descriptions?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName =
            capability.names.find { it.locale == defaultLocale?.localeCode }?.text
                ?: capability.names.firstOrNull()?.text
        val slug = SlugUtil.slugify(defaultName)

        if (capabilityRepository.existsByKey(slug)) {
            throw DuplicateResourceException("Capability with key '$slug' already exists")
        }
        capability.key = slug

        if (request.parentCapabilityKey != null) {
            capability.parent =
                capabilityRepository
                    .findByKey(request.parentCapabilityKey!!)
                    .orElseThrow { ResourceNotFoundException("Parent capability not found: ${request.parentCapabilityKey}") }
        }

        if (request.owningUnitKey != null) {
            capability.owningUnit =
                organisationalUnitRepository
                    .findByKey(request.owningUnitKey!!)
                    .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found: ${request.owningUnitKey}") }
        }

        val saved = capabilityRepository.save(capability)
        return capabilityMapper.toCapabilityResponse(saved)
    }

    @Transactional
    open fun update(
        key: String,
        request: UpdateCapabilityRequest
    ): CapabilityResponse {
        val capability =
            capabilityRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("Capability not found: $key") }

        capability.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        capability.descriptions = request.descriptions?.map { LocalizedText(it.locale, it.text) }?.toMutableList() ?: mutableListOf()
        capability.updatedAt = Instant.now()

        capability.parent =
            if (request.parentCapabilityKey != null) {
                capabilityRepository
                    .findByKey(request.parentCapabilityKey!!)
                    .orElseThrow { ResourceNotFoundException("Parent capability not found: ${request.parentCapabilityKey}") }
            } else {
                null
            }

        capability.owningUnit =
            if (request.owningUnitKey != null) {
                organisationalUnitRepository
                    .findByKey(request.owningUnitKey!!)
                    .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found: ${request.owningUnitKey}") }
            } else {
                null
            }

        capabilityRepository.update(capability)
        return capabilityRepository
            .findByKey(capability.key)
            .map { capabilityMapper.toCapabilityResponse(it) }
            .orElseThrow { ResourceNotFoundException("Capability not found after update: $key") }
    }

    @Transactional
    open fun delete(key: String) {
        val capability =
            capabilityRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("Capability not found: $key") }
        capabilityRepository.delete(capability)
    }

    @Transactional
    open fun updateLinkedProcesses(
        key: String,
        processKeys: List<String>
    ) {
        val capability =
            capabilityRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("Capability not found: $key") }

        val newProcesses =
            processKeys.map { processKey ->
                processRepository
                    .findByKey(processKey)
                    .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }
            }

        capability.linkedProcesses.clear()
        capability.linkedProcesses.addAll(newProcesses)
        capabilityRepository.update(capability)
    }

    @Transactional
    open fun assignClassifications(
        key: String,
        assignments: List<ClassificationAssignmentRequest>
    ) {
        val capability =
            capabilityRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("Capability not found: $key") }

        assignments.groupBy { it.classificationKey }.forEach { (classKey, group) ->
            val classification =
                classificationRepository
                    .findByKey(classKey)
                    .orElseThrow { ResourceNotFoundException("Classification not found: $classKey") }

            if (classification.assignableTo != "CAPABILITY") {
                throw IllegalArgumentException("Classification '$classKey' is not assignable to CAPABILITY")
            }

            if (group.size > 1 && !classification.multiValue) {
                throw IllegalArgumentException(
                    "Classification '$classKey' is single-value: only one value can be assigned"
                )
            }

            group.forEach { assignment ->
                classification.values.find { it.key == assignment.valueKey }
                    ?: throw ResourceNotFoundException(
                        "Classification value '${assignment.valueKey}' not found in classification '$classKey'"
                    )
            }
        }

        capability.classificationAssignments =
            assignments
                .map { ClassificationAssignment(it.classificationKey, it.valueKey) }
                .toMutableList()
        capabilityRepository.update(capability)
    }
}
