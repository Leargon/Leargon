package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.TranslationLink
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.TranslationLinkMapper
import org.leargon.backend.model.CreateTranslationLinkRequest
import org.leargon.backend.model.TranslationLinkResponse
import org.leargon.backend.model.UpdateTranslationLinkRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.TranslationLinkRepository

@Singleton
open class TranslationLinkService(
    private val translationLinkRepository: TranslationLinkRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val translationLinkMapper: TranslationLinkMapper
) {

    @Transactional
    open fun getForEntity(entityKey: String): List<TranslationLinkResponse> {
        val entity = businessEntityRepository.findByKey(entityKey)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found: $entityKey") }
        val mapper = translationLinkMapper
        val byFirst = translationLinkRepository.findByFirstEntityKey(entityKey)
        val bySecond = translationLinkRepository.findBySecondEntityKey(entityKey)
        return (byFirst + bySecond).map { mapper.toResponse(it, entity) }
    }

    @Transactional
    open fun create(request: CreateTranslationLinkRequest, currentUser: User): TranslationLink {
        val first = businessEntityRepository.findByKey(request.firstEntityKey)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found: ${request.firstEntityKey}") }
        val second = businessEntityRepository.findByKey(request.secondEntityKey)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found: ${request.secondEntityKey}") }

        if (first.boundedContext?.id != null && second.boundedContext?.id != null &&
            first.boundedContext?.id == second.boundedContext?.id) {
            throw IllegalArgumentException("Translation links must connect entities from different bounded contexts")
        }

        if (translationLinkRepository.existsByFirstEntityIdAndSecondEntityId(first.id!!, second.id!!) ||
            translationLinkRepository.existsByFirstEntityIdAndSecondEntityId(second.id!!, first.id!!)) {
            throw IllegalArgumentException("Translation link between these entities already exists")
        }

        val link = TranslationLink()
        link.firstEntity = first
        link.secondEntity = second
        link.semanticDifferenceNote = request.semanticDifferenceNote
        link.createdBy = currentUser
        return translationLinkRepository.save(link)
    }

    @Transactional
    open fun update(id: Long, request: UpdateTranslationLinkRequest, currentUser: User): TranslationLinkResponse {
        val link = translationLinkRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("TranslationLink not found: $id") }
        checkEditPermission(link, currentUser)
        link.semanticDifferenceNote = request.semanticDifferenceNote
        val updated = translationLinkRepository.update(link)
        val entity = updated.firstEntity!!
        val mapper = translationLinkMapper
        return mapper.toResponse(updated, entity)
    }

    @Transactional
    open fun delete(id: Long, currentUser: User) {
        val link = translationLinkRepository.findById(id)
            .orElseThrow { ResourceNotFoundException("TranslationLink not found: $id") }
        checkEditPermission(link, currentUser)
        translationLinkRepository.deleteById(id)
    }

    private fun checkEditPermission(link: TranslationLink, currentUser: User) {
        val isCreator = link.createdBy?.id == currentUser.id
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        if (!isCreator && !isAdmin) {
            throw ForbiddenOperationException("Only the creator or an admin can modify this translation link")
        }
    }
}
