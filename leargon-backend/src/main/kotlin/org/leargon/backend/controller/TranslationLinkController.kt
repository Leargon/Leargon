package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.TranslationLinkApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.TranslationLinkMapper
import org.leargon.backend.model.CreateTranslationLinkRequest
import org.leargon.backend.model.TranslationLinkResponse
import org.leargon.backend.model.UpdateTranslationLinkRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.service.TranslationLinkService
import org.leargon.backend.service.UserService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class TranslationLinkController(
    private val translationLinkService: TranslationLinkService,
    private val translationLinkMapper: TranslationLinkMapper,
    private val businessEntityRepository: BusinessEntityRepository,
    private val userService: UserService,
    private val securityService: SecurityService
) : TranslationLinkApi {
    override fun getAllTranslationLinks(): List<TranslationLinkResponse> = translationLinkService.getAll()

    override fun getEntityTranslationLinks(key: String): List<TranslationLinkResponse> = translationLinkService.getForEntity(key)

    override fun createTranslationLink(
        @Valid @Body createTranslationLinkRequest: CreateTranslationLinkRequest
    ): HttpResponse<TranslationLinkResponse> {
        val currentUser = getCurrentUser()
        val link = translationLinkService.create(createTranslationLinkRequest, currentUser)
        val firstEntity = link.firstEntity!!
        val response = translationLinkMapper.toResponse(link, firstEntity)
        return HttpResponse.status<TranslationLinkResponse>(HttpStatus.CREATED).body(response)
    }

    override fun updateTranslationLink(
        id: Long,
        @Valid @Body updateTranslationLinkRequest: UpdateTranslationLinkRequest
    ): TranslationLinkResponse {
        val currentUser = getCurrentUser()
        return translationLinkService.update(id, updateTranslationLinkRequest, currentUser)
    }

    override fun deleteTranslationLink(id: Long): HttpResponse<Void> {
        val currentUser = getCurrentUser()
        translationLinkService.delete(id, currentUser)
        return HttpResponse.noContent()
    }

    private fun getCurrentUser(): User {
        val email =
            securityService
                .username()
                .orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService
            .findByEmail(email)
            .orElseThrow { ResourceNotFoundException("User not found") }
    }
}
