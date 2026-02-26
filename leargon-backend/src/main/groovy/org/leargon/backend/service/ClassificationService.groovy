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
class ClassificationService {

    private final ClassificationRepository classificationRepository
    private final ClassificationValueRepository classificationValueRepository
    private final BusinessEntityRepository businessEntityRepository
    private final BusinessDomainRepository businessDomainRepository
    private final ProcessRepository processRepository
    private final OrganisationalUnitRepository organisationalUnitRepository
    private final BusinessEntityService businessEntityService
    private final LocaleService localeService
    private final ClassificationMapper classificationMapper

    ClassificationService(
            ClassificationRepository classificationRepository,
            ClassificationValueRepository classificationValueRepository,
            BusinessEntityRepository businessEntityRepository,
            BusinessDomainRepository businessDomainRepository,
            ProcessRepository processRepository,
            OrganisationalUnitRepository organisationalUnitRepository,
            BusinessEntityService businessEntityService,
            LocaleService localeService,
            ClassificationMapper classificationMapper
    ) {
        this.classificationRepository = classificationRepository
        this.classificationValueRepository = classificationValueRepository
        this.businessEntityRepository = businessEntityRepository
        this.businessDomainRepository = businessDomainRepository
        this.processRepository = processRepository
        this.organisationalUnitRepository = organisationalUnitRepository
        this.businessEntityService = businessEntityService
        this.localeService = localeService
        this.classificationMapper = classificationMapper
    }

    @Transactional
    List<ClassificationResponse> getClassifications(String assignableTo) {
        def m = this.classificationMapper
        List<Classification> classifications
        if (assignableTo != null) {
            classifications = classificationRepository.findByAssignableTo(assignableTo)
        } else {
            classifications = classificationRepository.findAll()
        }
        return classifications.collect { m.toClassificationResponse(it) }
    }

    @Transactional
    ClassificationResponse getClassificationByKeyAsResponse(String key) {
        def classification = getClassificationByKey(key)
        return classificationMapper.toClassificationResponse(classification)
    }

    Classification getClassificationByKey(String key) {
        return classificationRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("Classification not found"))
    }

    @Transactional
    ClassificationResponse createClassification(CreateClassificationRequest request, User currentUser) {
        checkAdminRole(currentUser)
        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        Classification classification = new Classification()
        classification.createdBy = currentUser
        classification.assignableTo = request.assignableTo.value

        classification.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            classification.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        String defaultName = classification.names.find { it.locale == defaultLocale.localeCode }?.text
        classification.key = SlugUtil.slugify(defaultName)

        classification = classificationRepository.save(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    ClassificationResponse updateClassification(String key, UpdateClassificationRequest request, User currentUser) {
        checkAdminRole(currentUser)
        Classification classification = getClassificationByKey(key)

        if (request.names != null && !request.names.isEmpty()) {
            validateTranslations(request.names)
            classification.names = request.names.collect { input ->
                new LocalizedText(input.locale, input.text)
            }

            def ls = this.localeService
            def defaultLocale = ls.getDefaultLocale()
            String defaultName = classification.names.find { it.locale == defaultLocale.localeCode }?.text
            classification.key = SlugUtil.slugify(defaultName)
        }

        if (request.descriptions != null) {
            if (!request.descriptions.isEmpty()) {
                validateTranslations(request.descriptions, false)
            }
            classification.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    void deleteClassification(String key, User currentUser) {
        checkAdminRole(currentUser)
        Classification classification = getClassificationByKey(key)

        // Capture for closure access (Micronaut AOP proxy issue)
        def entityRepo = this.businessEntityRepository
        def domainRepo = this.businessDomainRepository
        def processRepo = this.processRepository
        def orgUnitRepo = this.organisationalUnitRepository

        // Remove assignments from entities
        def entities = entityRepo.findAll()
        entities.each { entity ->
            if (entity.classificationAssignments?.any { it.classificationKey == key }) {
                entity.classificationAssignments = entity.classificationAssignments.findAll { it.classificationKey != key }
                entityRepo.update(entity)
            }
        }

        // Remove assignments from domains
        def domains = domainRepo.findAll()
        domains.each { domain ->
            if (domain.classificationAssignments?.any { it.classificationKey == key }) {
                domain.classificationAssignments = domain.classificationAssignments.findAll { it.classificationKey != key }
                domainRepo.update(domain)
            }
        }

        // Remove assignments from processes
        def processes = processRepo.findAll()
        processes.each { process ->
            if (process.classificationAssignments?.any { it.classificationKey == key }) {
                process.classificationAssignments = process.classificationAssignments.findAll { it.classificationKey != key }
                processRepo.update(process)
            }
        }

        // Remove assignments from organisational units
        def orgUnits = orgUnitRepo.findAll()
        orgUnits.each { unit ->
            if (unit.classificationAssignments?.any { it.classificationKey == key }) {
                unit.classificationAssignments = unit.classificationAssignments.findAll { it.classificationKey != key }
                orgUnitRepo.update(unit)
            }
        }

        classificationRepository.delete(classification)
    }

    @Transactional
    ClassificationResponse createClassificationValue(String classificationKey, CreateClassificationValueRequest request, User currentUser) {
        checkAdminRole(currentUser)
        Classification classification = getClassificationByKey(classificationKey)

        // Check value key uniqueness within classification
        if (classification.values.any { it.key == request.key }) {
            throw new IllegalArgumentException("Value key '${request.key}' already exists in this classification")
        }

        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        ClassificationValue value = new ClassificationValue()
        value.key = request.key
        value.createdBy = currentUser
        value.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            value.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        classification.addValue(value)
        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    ClassificationResponse updateClassificationValue(String classificationKey, String valueKey, UpdateClassificationValueRequest request, User currentUser) {
        checkAdminRole(currentUser)
        Classification classification = getClassificationByKey(classificationKey)

        ClassificationValue value = classification.values.find { it.key == valueKey }
        if (value == null) {
            throw new ResourceNotFoundException("Classification value not found: ${valueKey}")
        }

        if (request.names != null && !request.names.isEmpty()) {
            validateTranslations(request.names)
            value.names = request.names.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        if (request.descriptions != null) {
            if (!request.descriptions.isEmpty()) {
                validateTranslations(request.descriptions, false)
            }
            value.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        classification = classificationRepository.update(classification)
        return classificationMapper.toClassificationResponse(classification)
    }

    @Transactional
    void deleteClassificationValue(String classificationKey, String valueKey, User currentUser) {
        checkAdminRole(currentUser)
        Classification classification = getClassificationByKey(classificationKey)

        ClassificationValue value = classification.values.find { it.key == valueKey }
        if (value == null) {
            throw new ResourceNotFoundException("Classification value not found: ${valueKey}")
        }

        // Capture for closure access (Micronaut AOP proxy issue)
        def entityRepo = this.businessEntityRepository
        def domainRepo = this.businessDomainRepository
        def processRepo = this.processRepository
        def orgUnitRepo = this.organisationalUnitRepository

        // Remove assignments referencing this value from entities
        def entities = entityRepo.findAll()
        entities.each { entity ->
            if (entity.classificationAssignments?.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                entity.classificationAssignments = entity.classificationAssignments.findAll {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }
                entityRepo.update(entity)
            }
        }

        // Remove assignments referencing this value from domains
        def domains = domainRepo.findAll()
        domains.each { domain ->
            if (domain.classificationAssignments?.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                domain.classificationAssignments = domain.classificationAssignments.findAll {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }
                domainRepo.update(domain)
            }
        }

        // Remove assignments referencing this value from processes
        def processes = processRepo.findAll()
        processes.each { process ->
            if (process.classificationAssignments?.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                process.classificationAssignments = process.classificationAssignments.findAll {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }
                processRepo.update(process)
            }
        }

        // Remove assignments referencing this value from organisational units
        def orgUnits = orgUnitRepo.findAll()
        orgUnits.each { unit ->
            if (unit.classificationAssignments?.any { it.classificationKey == classificationKey && it.valueKey == valueKey }) {
                unit.classificationAssignments = unit.classificationAssignments.findAll {
                    !(it.classificationKey == classificationKey && it.valueKey == valueKey)
                }
                orgUnitRepo.update(unit)
            }
        }

        classification.removeValue(value)
        classificationRepository.update(classification)
    }

    @Transactional
    void assignClassificationsToEntity(String entityKey, List<ClassificationAssignmentRequest> assignments, User currentUser) {
        def entity = businessEntityRepository.findByKey(entityKey)
                .orElseThrow(() -> new ResourceNotFoundException("BusinessEntity not found"))

        // Check permission - owner or admin
        boolean isOwner = entity.dataOwner.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        if (!isOwner && !isAdmin) {
            throw new ForbiddenOperationException("Only the data owner or an admin can assign classifications")
        }

        validateAssignments(assignments, "BUSINESS_ENTITY")

        entity.classificationAssignments = assignments.collect {
            new ClassificationAssignment(it.classificationKey, it.valueKey)
        }
        businessEntityRepository.update(entity)

        // Record version for classification change
        def bes = this.businessEntityService
        bes.recordVersion(entityKey, currentUser, "CLASSIFICATION_CHANGE",
                "Updated classification assignments")
    }

    @Transactional
    void assignClassificationsToDomain(String domainKey, List<ClassificationAssignmentRequest> assignments, User currentUser) {
        checkAdminRole(currentUser)

        def domain = businessDomainRepository.findByKey(domainKey)
                .orElseThrow(() -> new ResourceNotFoundException("BusinessDomain not found"))

        validateAssignments(assignments, "BUSINESS_DOMAIN")

        domain.classificationAssignments = assignments.collect {
            new ClassificationAssignment(it.classificationKey, it.valueKey)
        }
        businessDomainRepository.update(domain)
    }

    @Transactional
    void assignClassificationsToProcess(String processKey, List<ClassificationAssignmentRequest> assignments, User currentUser) {
        def processRepo = this.processRepository
        def process = processRepo.findByKey(processKey)
                .orElseThrow(() -> new ResourceNotFoundException("Process not found"))

        // Check permission - owner or admin
        boolean isOwner = process.processOwner.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        if (!isOwner && !isAdmin) {
            throw new ForbiddenOperationException("Only the process owner or an admin can assign classifications")
        }

        validateAssignments(assignments, "BUSINESS_PROCESS")

        process.classificationAssignments = assignments.collect {
            new ClassificationAssignment(it.classificationKey, it.valueKey)
        }
        processRepo.update(process)
    }

    @Transactional
    void assignClassificationsToOrgUnit(String orgUnitKey, List<ClassificationAssignmentRequest> assignments, User currentUser) {
        def orgUnitRepo = this.organisationalUnitRepository
        def unit = orgUnitRepo.findByKey(orgUnitKey)
                .orElseThrow(() -> new ResourceNotFoundException("OrganisationalUnit not found"))

        // Check permission - lead or admin
        boolean isLead = unit.lead?.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")
        if (!isLead && !isAdmin) {
            throw new ForbiddenOperationException("Only the lead or an admin can assign classifications")
        }

        validateAssignments(assignments, "ORGANISATIONAL_UNIT")

        unit.classificationAssignments = assignments.collect {
            new org.leargon.backend.domain.ClassificationAssignment(it.classificationKey, it.valueKey)
        }
        orgUnitRepo.update(unit)
    }

    private void validateAssignments(List<ClassificationAssignmentRequest> assignments, String expectedAssignableTo) {
        // Check for duplicate classification keys (mutual exclusivity)
        def classificationKeys = assignments*.classificationKey
        if (classificationKeys.size() != classificationKeys.toSet().size()) {
            throw new IllegalArgumentException("Duplicate classification keys: only one value per classification is allowed")
        }

        // Capture for closure access (Micronaut AOP proxy issue)
        def repo = this.classificationRepository

        assignments.each { assignment ->
            def classification = repo.findByKey(assignment.classificationKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Classification not found: ${assignment.classificationKey}"))

            if (classification.assignableTo != expectedAssignableTo) {
                throw new IllegalArgumentException(
                        "Classification '${assignment.classificationKey}' is not assignable to ${expectedAssignableTo}")
            }

            def value = classification.values.find { it.key == assignment.valueKey }
            if (value == null) {
                throw new ResourceNotFoundException(
                        "Classification value '${assignment.valueKey}' not found in classification '${assignment.classificationKey}'")
            }
        }
    }

    private void validateTranslations(List<org.leargon.backend.model.LocalizedText> translations, boolean requireDefault = true) {
        if (translations == null || translations.isEmpty()) {
            if (requireDefault) {
                throw new IllegalArgumentException("At least one translation is required")
            }
            return
        }

        // Capture for closure access (Micronaut AOP proxy issue)
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        if (defaultLocale == null) {
            throw new IllegalStateException("No default locale configured")
        }

        def defaultLocaleCode = defaultLocale.localeCode
        translations.each { translation ->
            if (!ls.isLocaleActive(translation.locale)) {
                throw new IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text == null || translation.text.trim().isEmpty()) {
                throw new IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            def defaultTranslation = translations.find { it.locale == defaultLocaleCode }
            if (defaultTranslation == null) {
                throw new IllegalArgumentException(
                        "Translation for default locale '${defaultLocaleCode}' is required")
            }
        }
    }

    private static void checkAdminRole(User user) {
        if (!user.roles?.contains("ROLE_ADMIN")) {
            throw new ForbiddenOperationException("This operation requires admin privileges")
        }
    }
}
