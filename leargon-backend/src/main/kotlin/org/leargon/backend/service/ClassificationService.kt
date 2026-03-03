package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.Classification
import org.leargon.backend.domain.ClassificationAssignment
import org.leargon.backend.domain.ClassificationValue
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ClassificationMapper
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.model.ClassificationResponse
import org.leargon.backend.model.CreateClassificationRequest
import org.leargon.backend.model.CreateClassificationValueRequest
import org.leargon.backend.model.UpdateClassificationRequest
import org.leargon.backend.model.UpdateClassificationValueRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class ClassificationService(
    private val classificationRepository: ClassificationRepository,
    private val classificationValueRepository: ClassificationValueRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val businessEntityService: BusinessEntityService,
    private val localeService: LocaleService,
    private val classificationMapper: ClassificationMapper
) {

    @Transactional
    open fun getClassifications(assignableTo: String?): List<ClassificationResponse> {
        val classifications = if (assignableTo != null) {
            classificationRepository.findByAssignableTo(assignableTo)
        } else {
            classificationRepository.findAll()
        }
        return classifications.map { classificationMapper.toClassificationResponse(it) }
    }

    @Transactional
    open fun getClassificationByKeyAsResponse(key: String): ClassificationResponse {
        val classification = getClassificationByKey(key)
        return classificationMapper.toClassificationResponse(classification)
    }

    open fun getClassificationByKey(key: String): Classification =
        classificationRepository.findByKey(key)
            .orElseThrow { ResourceNotFoundException("Classification not found") }

    @Transactional
    open fun createClassification(request: CreateClassificationRequest, currentUser: User): ClassificationResponse {
        checkAdminRole(currentUser)
        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        var classification = Classification()
        classification.createdBy = currentUser
        classification.assignableTo = request.assignableTo.value

        classification.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            classification.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        val defaultLocale = localeService.getDefaultLocale()
        val defaultName = classification.names.find { it.locale == defaultLocale?.localeCode }?.text
        classification.key = SlugUtil.slugify(defaultName)

        classification = classificationRepository.save(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    open fun updateClassification(key: String, request: UpdateClassificationRequest, currentUser: User): ClassificationResponse {
        checkAdminRole(currentUser)
        var classification = getClassificationByKey(key)

        if (!request.names.isNullOrEmpty()) {
            validateTranslations(request.names)
            classification.names = request.names!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

            val defaultLocale = localeService.getDefaultLocale()
            val defaultName = classification.names.find { it.locale == defaultLocale?.localeCode }?.text
            classification.key = SlugUtil.slugify(defaultName)
        }

        if (request.descriptions != null) {
            if (!request.descriptions!!.isEmpty()) {
                validateTranslations(request.descriptions, false)
            }
            classification.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    open fun deleteClassification(key: String, currentUser: User) {
        checkAdminRole(currentUser)
        val classification = getClassificationByKey(key)

        // Remove assignments from entities
        businessEntityRepository.findAll().forEach { entity ->
            if (entity.classificationAssignments.any { it.classificationKey == key }) {
                entity.classificationAssignments = entity.classificationAssignments.filter { it.classificationKey != key }.toMutableList()
                businessEntityRepository.update(entity)
            }
        }

        // Remove assignments from domains
        businessDomainRepository.findAll().forEach { domain ->
            if (domain.classificationAssignments.any { it.classificationKey == key }) {
                domain.classificationAssignments = domain.classificationAssignments.filter { it.classificationKey != key }.toMutableList()
                businessDomainRepository.update(domain)
            }
        }

        // Remove assignments from processes
        processRepository.findAll().forEach { process ->
            if (process.classificationAssignments.any { it.classificationKey == key }) {
                process.classificationAssignments = process.classificationAssignments.filter { it.classificationKey != key }.toMutableList()
                processRepository.update(process)
            }
        }

        // Remove assignments from organisational units
        organisationalUnitRepository.findAll().forEach { unit ->
            if (unit.classificationAssignments.any { it.classificationKey == key }) {
                unit.classificationAssignments = unit.classificationAssignments.filter { it.classificationKey != key }.toMutableList()
                organisationalUnitRepository.update(unit)
            }
        }

        classificationRepository.delete(classification)
    }

    @Transactional
    open fun createClassificationValue(classificationKey: String, request: CreateClassificationValueRequest, currentUser: User): ClassificationResponse {
        checkAdminRole(currentUser)
        var classification = getClassificationByKey(classificationKey)

        if (classification.values.any { it.key == request.key }) {
            throw IllegalArgumentException("Value key '${request.key}' already exists in this classification")
        }

        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        val value = ClassificationValue()
        value.key = request.key
        value.createdBy = currentUser
        value.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            value.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        classification.addValue(value)
        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    open fun updateClassificationValue(classificationKey: String, valueKey: String, request: UpdateClassificationValueRequest, currentUser: User): ClassificationResponse {
        checkAdminRole(currentUser)
        var classification = getClassificationByKey(classificationKey)

        val value = classification.values.find { it.key == valueKey }
            ?: throw ResourceNotFoundException("Classification value not found: $valueKey")

        if (!request.names.isNullOrEmpty()) {
            validateTranslations(request.names)
            value.names = request.names!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        if (request.descriptions != null) {
            if (!request.descriptions!!.isEmpty()) {
                validateTranslations(request.descriptions, false)
            }
            value.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    open fun deleteClassificationValue(classificationKey: String, valueKey: String, currentUser: User) {
        checkAdminRole(currentUser)
        var classification = getClassificationByKey(classificationKey)

        val value = classification.values.find { it.key == valueKey }
            ?: throw ResourceNotFoundException("Classification value not found: $valueKey")

        // Remove assignments from entities
        businessEntityRepository.findAll().forEach { entity ->
            if (entity.classificationAssignments.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                entity.classificationAssignments = entity.classificationAssignments.filter {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }.toMutableList()
                businessEntityRepository.update(entity)
            }
        }

        // Remove assignments from domains
        businessDomainRepository.findAll().forEach { domain ->
            if (domain.classificationAssignments.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                domain.classificationAssignments = domain.classificationAssignments.filter {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }.toMutableList()
                businessDomainRepository.update(domain)
            }
        }

        // Remove assignments from processes
        processRepository.findAll().forEach { process ->
            if (process.classificationAssignments.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                process.classificationAssignments = process.classificationAssignments.filter {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }.toMutableList()
                processRepository.update(process)
            }
        }

        // Remove assignments from organisational units
        organisationalUnitRepository.findAll().forEach { unit ->
            if (unit.classificationAssignments.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                unit.classificationAssignments = unit.classificationAssignments.filter {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }.toMutableList()
                organisationalUnitRepository.update(unit)
            }
        }

        classification.removeValue(value)
        classificationRepository.update(classification)
    }

    @Transactional
    open fun assignClassificationsToEntity(entityKey: String, assignments: List<ClassificationAssignmentRequest>, currentUser: User) {
        val entity = businessEntityRepository.findByKey(entityKey)
            .orElseThrow { ResourceNotFoundException("BusinessEntity not found") }

        val isOwner = entity.dataOwner!!.id == currentUser.id
        val isAdmin = currentUser.roles?.contains("ROLE_ADMIN") == true
        if (!isOwner && !isAdmin) {
            throw ForbiddenOperationException("Only the data owner or an admin can assign classifications")
        }

        validateAssignments(assignments, "BUSINESS_ENTITY")

        entity.classificationAssignments = assignments.map {
            ClassificationAssignment(it.classificationKey, it.valueKey)
        }.toMutableList()
        businessEntityRepository.update(entity)

        businessEntityService.recordVersion(entityKey, currentUser, "CLASSIFICATION_CHANGE",
            "Updated classification assignments")
    }

    @Transactional
    open fun assignClassificationsToDomain(domainKey: String, assignments: List<ClassificationAssignmentRequest>, currentUser: User) {
        checkAdminRole(currentUser)

        val domain = businessDomainRepository.findByKey(domainKey)
            .orElseThrow { ResourceNotFoundException("BusinessDomain not found") }

        validateAssignments(assignments, "BUSINESS_DOMAIN")

        domain.classificationAssignments = assignments.map {
            ClassificationAssignment(it.classificationKey, it.valueKey)
        }.toMutableList()
        businessDomainRepository.update(domain)
    }

    @Transactional
    open fun assignClassificationsToProcess(processKey: String, assignments: List<ClassificationAssignmentRequest>, currentUser: User) {
        val process = processRepository.findByKey(processKey)
            .orElseThrow { ResourceNotFoundException("Process not found") }

        val isOwner = process.processOwner!!.id == currentUser.id
        val isAdmin = currentUser.roles?.contains("ROLE_ADMIN") == true
        if (!isOwner && !isAdmin) {
            throw ForbiddenOperationException("Only the process owner or an admin can assign classifications")
        }

        validateAssignments(assignments, "BUSINESS_PROCESS")

        process.classificationAssignments = assignments.map {
            ClassificationAssignment(it.classificationKey, it.valueKey)
        }.toMutableList()
        processRepository.update(process)
    }

    @Transactional
    open fun assignClassificationsToOrgUnit(orgUnitKey: String, assignments: List<ClassificationAssignmentRequest>, currentUser: User) {
        val unit = organisationalUnitRepository.findByKey(orgUnitKey)
            .orElseThrow { ResourceNotFoundException("OrganisationalUnit not found") }

        val isLead = unit.lead?.id == currentUser.id
        val isAdmin = currentUser.roles?.contains("ROLE_ADMIN") == true
        if (!isLead && !isAdmin) {
            throw ForbiddenOperationException("Only the lead or an admin can assign classifications")
        }

        validateAssignments(assignments, "ORGANISATIONAL_UNIT")

        unit.classificationAssignments = assignments.map {
            ClassificationAssignment(it.classificationKey, it.valueKey)
        }.toMutableList()
        organisationalUnitRepository.update(unit)
    }

    private fun validateAssignments(assignments: List<ClassificationAssignmentRequest>, expectedAssignableTo: String) {
        val classificationKeys = assignments.map { it.classificationKey }
        if (classificationKeys.size != classificationKeys.toSet().size) {
            throw IllegalArgumentException("Duplicate classification keys: only one value per classification is allowed")
        }

        assignments.forEach { assignment ->
            val classification = classificationRepository.findByKey(assignment.classificationKey)
                .orElseThrow { ResourceNotFoundException("Classification not found: ${assignment.classificationKey}") }

            if (classification.assignableTo != expectedAssignableTo) {
                throw IllegalArgumentException(
                    "Classification '${assignment.classificationKey}' is not assignable to $expectedAssignableTo")
            }

            val value = classification.values.find { it.key == assignment.valueKey }
            if (value == null) {
                throw ResourceNotFoundException(
                    "Classification value '${assignment.valueKey}' not found in classification '${assignment.classificationKey}'")
            }
        }
    }

    private fun validateTranslations(translations: List<org.leargon.backend.model.LocalizedText>?, requireDefault: Boolean = true) {
        if (translations.isNullOrEmpty()) {
            if (requireDefault) throw IllegalArgumentException("At least one translation is required")
            return
        }

        val defaultLocale = localeService.getDefaultLocale()
            ?: throw IllegalStateException("No default locale configured")

        val defaultLocaleCode = defaultLocale.localeCode

        translations.forEach { translation ->
            if (!localeService.isLocaleActive(translation.locale)) {
                throw IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text.isNullOrBlank()) {
                throw IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            val defaultTranslation = translations.find { it.locale == defaultLocaleCode }
            if (defaultTranslation == null) {
                throw IllegalArgumentException(
                    "Translation for default locale '$defaultLocaleCode' is required")
            }
        }
    }

    companion object {
        @JvmStatic
        private fun checkAdminRole(user: User) {
            if (user.roles?.contains("ROLE_ADMIN") != true) {
                throw ForbiddenOperationException("This operation requires admin privileges")
            }
        }
    }
}
