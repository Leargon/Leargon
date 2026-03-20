package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.BoundedContextMapper
import org.leargon.backend.model.BoundedContextResponse
import org.leargon.backend.model.CreateBoundedContextRequest
import org.leargon.backend.model.UpdateBoundedContextDescriptionsRequest
import org.leargon.backend.model.UpdateBoundedContextNamesRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class BoundedContextService(
    private val boundedContextRepository: BoundedContextRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val localeService: LocaleService,
    private val boundedContextMapper: BoundedContextMapper
) {

    open fun getByKey(key: String): BoundedContext =
        boundedContextRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("BoundedContext not found: $key") }

    @Transactional
    open fun getByKeyAsResponse(key: String): BoundedContextResponse =
        boundedContextMapper.toResponse(getByKey(key))

    @Transactional
    open fun getForDomain(domainKey: String): List<BoundedContextResponse> {
        if (!businessDomainRepository.findByKey(domainKey).isPresent) {
            throw ResourceNotFoundException("BusinessDomain not found: $domainKey")
        }
        val mapper = boundedContextMapper
        return boundedContextRepository.findByDomainKey(domainKey).map { mapper.toResponse(it) }
    }

    @Transactional
    open fun create(domainKey: String, request: CreateBoundedContextRequest, currentUser: User): BoundedContext {
        val domain = businessDomainRepository.findByKey(domainKey)
            .orElseThrow { ResourceNotFoundException("BusinessDomain not found: $domainKey") }

        val bc = BoundedContext()
        bc.domain = domain
        bc.createdBy = currentUser
        bc.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        if (request.descriptions != null) {
            bc.descriptions = request.descriptions!!.map { LocalizedText(it.locale, it.text) }.toMutableList()
        }
        if (request.contextType != null) {
            bc.contextType = request.contextType!!.value
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = bc.names.find { it.locale == defaultLocale?.localeCode }?.text
        val slug = SlugUtil.slugify(defaultName)
        bc.key = "${domainKey}/${slug}"

        return boundedContextRepository.save(bc)
    }

    @Transactional
    open fun createDefaultForDomain(domain: BusinessDomain, currentUser: User): BoundedContext {
        val bc = BoundedContext()
        bc.domain = domain
        bc.createdBy = currentUser
        bc.names = mutableListOf()
        bc.key = "${domain.key}/default"
        return boundedContextRepository.save(bc)
    }

    @Transactional
    open fun updateNames(key: String, request: UpdateBoundedContextNamesRequest, currentUser: User): BoundedContextResponse {
        val bc = getByKey(key)
        bc.names = request.names.map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun updateDescriptions(key: String, request: UpdateBoundedContextDescriptionsRequest, currentUser: User): BoundedContextResponse {
        val bc = getByKey(key)
        bc.descriptions = (request.descriptions ?: emptyList()).map { LocalizedText(it.locale, it.text) }.toMutableList()
        val updated = boundedContextRepository.update(bc)
        val mapper = boundedContextMapper
        return mapper.toResponse(updated)
    }

    @Transactional
    open fun delete(key: String, currentUser: User) {
        val bc = getByKey(key)
        if (!currentUser.roles.contains("ROLE_ADMIN")) {
            throw ForbiddenOperationException("Only admins can delete bounded contexts")
        }
        boundedContextRepository.delete(bc)
    }
}
