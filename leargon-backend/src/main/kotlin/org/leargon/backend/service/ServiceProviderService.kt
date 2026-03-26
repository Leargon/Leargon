package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.ServiceProvider
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ServiceProviderMapper
import org.leargon.backend.model.CreateServiceProviderRequest
import org.leargon.backend.model.ServiceProviderResponse
import org.leargon.backend.model.UpdateServiceProviderRequest
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.util.SlugUtil
import java.time.Instant

@Singleton
open class ServiceProviderService(
    private val serviceProviderRepository: ServiceProviderRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val serviceProviderMapper: ServiceProviderMapper,
    private val localeService: LocaleService
) {
    @Transactional
    open fun getAll(): List<ServiceProviderResponse> {
        val mapper = serviceProviderMapper
        return serviceProviderRepository.findAll().map { mapper.toServiceProviderResponse(it) }
    }

    @Transactional
    open fun getByKey(key: String): ServiceProviderResponse {
        val sp =
            serviceProviderRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $key") }
        val mapper = serviceProviderMapper
        return mapper.toServiceProviderResponse(sp)
    }

    @Transactional
    open fun create(request: CreateServiceProviderRequest): ServiceProviderResponse {
        val sp = ServiceProvider()
        sp.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        sp.serviceProviderType = request.serviceProviderType?.value ?: "DATA_PROCESSOR"
        sp.processingCountries = (request.processingCountries ?: emptyList()).toMutableList()
        sp.processorAgreementInPlace = request.processorAgreementInPlace ?: false
        sp.subProcessorsApproved = request.subProcessorsApproved ?: false

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName =
            sp.names.find { it.locale == defaultLocale?.localeCode }?.text
                ?: sp.names.firstOrNull()?.text
        val slug = SlugUtil.slugify(defaultName)

        if (serviceProviderRepository.existsByKey(slug)) {
            throw DuplicateResourceException("ServiceProvider with key '$slug' already exists")
        }
        sp.key = slug

        val saved = serviceProviderRepository.save(sp)
        return serviceProviderMapper.toServiceProviderResponse(saved)
    }

    @Transactional
    open fun update(
        key: String,
        request: UpdateServiceProviderRequest
    ): ServiceProviderResponse {
        val sp =
            serviceProviderRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $key") }

        sp.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        sp.serviceProviderType = request.serviceProviderType?.value ?: sp.serviceProviderType
        sp.processingCountries = (request.processingCountries ?: emptyList()).toMutableList()
        sp.processorAgreementInPlace = request.processorAgreementInPlace ?: false
        sp.subProcessorsApproved = request.subProcessorsApproved ?: false
        sp.updatedAt = Instant.now()

        val updated = serviceProviderRepository.update(sp)
        return serviceProviderRepository
            .findByKey(updated.key)
            .map { serviceProviderMapper.toServiceProviderResponse(it) }
            .orElseThrow { ResourceNotFoundException("ServiceProvider not found after update: $key") }
    }

    @Transactional
    open fun delete(key: String) {
        val sp =
            serviceProviderRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $key") }
        serviceProviderRepository.delete(sp)
    }

    @Transactional
    open fun updateLinkedProcesses(
        key: String,
        processKeys: List<String>
    ) {
        val sp =
            serviceProviderRepository
                .findByKey(key)
                .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $key") }

        val newProcesses =
            processKeys.map { processKey ->
                processRepository
                    .findByKey(processKey)
                    .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }
            }

        sp.linkedProcesses.clear()
        sp.linkedProcesses.addAll(newProcesses)
        serviceProviderRepository.update(sp)
    }

    @Transactional
    open fun updateProcessServiceProviders(
        processKey: String,
        spKeys: List<String>
    ) {
        val process =
            processRepository
                .findByKey(processKey)
                .orElseThrow { ResourceNotFoundException("Process not found: $processKey") }

        val desired =
            spKeys
                .map { spKey ->
                    serviceProviderRepository
                        .findByKey(spKey)
                        .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $spKey") }
                }.toSet()

        val current = serviceProviderRepository.findByLinkedProcessesKey(processKey)
        current.forEach { sp ->
            sp.linkedProcesses.remove(process)
            serviceProviderRepository.update(sp)
        }
        desired.forEach { sp ->
            sp.linkedProcesses.add(process)
            serviceProviderRepository.update(sp)
        }
    }

    @Transactional
    open fun updateOrgUnitServiceProviders(
        orgUnitKey: String,
        spKeys: List<String>
    ) {
        val orgUnit =
            organisationalUnitRepository
                .findByKey(orgUnitKey)
                .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found: $orgUnitKey") }

        val desired =
            spKeys
                .map { spKey ->
                    serviceProviderRepository
                        .findByKey(spKey)
                        .orElseThrow { ResourceNotFoundException("ServiceProvider not found: $spKey") }
                }.toSet()

        orgUnit.serviceProviders.clear()
        orgUnit.serviceProviders.addAll(desired)
        organisationalUnitRepository.update(orgUnit)
    }
}
