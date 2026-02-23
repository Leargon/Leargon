package org.leargon.backend.service

import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import io.micronaut.retry.annotation.Retryable
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.ProcessVersion
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.ProcessMapper
import org.leargon.backend.model.*
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ProcessElementRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.SlugUtil

@Singleton
class ProcessService {

    private final ProcessRepository processRepository
    private final ProcessVersionRepository processVersionRepository
    private final BusinessEntityRepository businessEntityRepository
    private final BusinessDomainRepository businessDomainRepository
    private final ProcessElementRepository processElementRepository
    private final UserRepository userRepository
    private final LocaleService localeService
    private final ProcessMapper processMapper
    private final BusinessEntityService businessEntityService
    private final JsonSlurper jsonSlurper = new JsonSlurper()

    ProcessService(
            ProcessRepository processRepository,
            ProcessVersionRepository processVersionRepository,
            BusinessEntityRepository businessEntityRepository,
            BusinessDomainRepository businessDomainRepository,
            ProcessElementRepository processElementRepository,
            UserRepository userRepository,
            LocaleService localeService,
            ProcessMapper processMapper,
            BusinessEntityService businessEntityService
    ) {
        this.processRepository = processRepository
        this.processVersionRepository = processVersionRepository
        this.businessEntityRepository = businessEntityRepository
        this.businessDomainRepository = businessDomainRepository
        this.processElementRepository = processElementRepository
        this.userRepository = userRepository
        this.localeService = localeService
        this.processMapper = processMapper
        this.businessEntityService = businessEntityService
    }

    @Transactional
    List<ProcessResponse> getAllProcessesAsResponses() {
        def m = this.processMapper
        return processRepository.findAll().collect { m.toProcessResponse(it) }
    }

    @Transactional
    List<ProcessTreeResponse> getProcessTreeAsResponses() {
        def m = this.processMapper
        List<Process> roots = processRepository.findByParentIsNull()
        return m.toProcessTreeResponses(roots)
    }

    Process getProcessByKey(String key) {
        return processRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("Process not found"))
    }

    @Transactional
    ProcessResponse getProcessByKeyAsResponse(String key) {
        return processMapper.toProcessResponse(getProcessByKey(key))
    }

    @Transactional
    Process createProcess(CreateProcessRequest request, User currentUser) {
        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        Process process = new Process()
        process.createdBy = currentUser

        // Set process owner - default to creator
        if (request.processOwnerUsername != null) {
            process.processOwner = userRepository.findByUsername(request.processOwnerUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("Process owner user not found"))
        } else {
            process.processOwner = currentUser
        }

        // Set names and descriptions
        process.names = request.names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }
        if (request.descriptions != null) {
            process.descriptions = request.descriptions.collect { input ->
                new LocalizedText(input.locale, input.text)
            }
        }

        // Set code
        if (request.code != null) {
            process.code = request.code
        }

        // Set process type
        if (request.processType != null) {
            process.processType = request.processType.value
        }

        // Compute key: use code if set, else default locale name
        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        if (process.code != null && !process.code.trim().isEmpty()) {
            process.key = SlugUtil.slugify(process.code)
        } else {
            String defaultName = process.names.find { it.locale == defaultLocale.localeCode }?.text
            process.key = SlugUtil.slugify(defaultName)
        }

        // Set parent process
        if (request.parentProcessKey != null) {
            Process parentProcess = processRepository.findByKey(request.parentProcessKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Parent process not found: ${request.parentProcessKey}"))
            process.parent = parentProcess
        }

        // Resolve input entities
        if (request.inputEntityKeys != null) {
            def entityRepo = this.businessEntityRepository
            for (String entityKey : request.inputEntityKeys) {
                BusinessEntity entity = entityRepo.findByKey(entityKey)
                        .orElseThrow(() -> new ResourceNotFoundException("Input entity not found: ${entityKey}"))
                process.inputEntities.add(entity)
            }
        }

        // Resolve output entities
        if (request.outputEntityKeys != null) {
            def entityRepo = this.businessEntityRepository
            for (String entityKey : request.outputEntityKeys) {
                BusinessEntity entity = entityRepo.findByKey(entityKey)
                        .orElseThrow(() -> new ResourceNotFoundException("Output entity not found: ${entityKey}"))
                process.outputEntities.add(entity)
            }
        }

        process = processRepository.save(process)
        createProcessVersion(process, currentUser, "CREATE", "Initial creation")

        return process
    }

    @Transactional
    ProcessResponse updateProcessNames(String key, List<org.leargon.backend.model.LocalizedText> names, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        validateTranslations(names)

        process.names = names.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        // Recompute key if no code set
        if (process.code == null || process.code.trim().isEmpty()) {
            def ls = this.localeService
            def defaultLocale = ls.getDefaultLocale()
            String defaultName = process.names.find { it.locale == defaultLocale.localeCode }?.text
            process.key = SlugUtil.slugify(defaultName)
        }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated names")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    ProcessResponse updateProcessDescriptions(String key, List<org.leargon.backend.model.LocalizedText> descriptions, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        validateTranslations(descriptions, false)

        process.descriptions = descriptions.collect { input ->
            new LocalizedText(input.locale, input.text)
        }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated descriptions")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    ProcessResponse updateProcessType(String key, String processType, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        String oldType = process.processType ?: 'none'
        process.processType = processType

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "TYPE_CHANGE",
                "Changed process type from '${oldType}' to '${processType ?: 'none'}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    ProcessResponse updateProcessOwner(String key, String ownerUsername, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        User newOwner = userRepository.findByUsername(ownerUsername)
                .orElseThrow(() -> new ResourceNotFoundException("Process owner user not found"))
        process.processOwner = newOwner

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "OWNER_CHANGE",
                "Changed process owner to ${newOwner.username}")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    ProcessResponse updateProcessCode(String key, String code, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.code = code
        // Recompute key from code
        process.key = SlugUtil.slugify(code)

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated code to '${code}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    ProcessResponse assignBusinessDomain(String key, String domainKey, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        String oldDomainName = process.businessDomain?.getName('en') ?: 'none'

        if (domainKey != null) {
            process.businessDomain = businessDomainRepository.findByKey(domainKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Business domain not found"))
        } else {
            process.businessDomain = null
        }

        process = processRepository.update(process)

        String newDomainName = process.businessDomain?.getName('en') ?: 'none'
        createProcessVersion(process, currentUser, "UPDATE",
                "Domain assignment changed from '${oldDomainName}' to '${newDomainName}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    ProcessResponse addInput(String key, AddProcessEntityRequest request, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        BusinessEntity entity = resolveOrCreateEntity(request, currentUser)
        process.inputEntities.add(entity)

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE",
                "Added input entity '${entity.key}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    ProcessResponse removeInput(String key, String entityKey, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.inputEntities.removeIf { it.key == entityKey }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE",
                "Removed input entity '${entityKey}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    ProcessResponse addOutput(String key, AddProcessEntityRequest request, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        BusinessEntity entity = resolveOrCreateEntity(request, currentUser)
        process.outputEntities.add(entity)

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE",
                "Added output entity '${entity.key}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    ProcessResponse removeOutput(String key, String entityKey, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.outputEntities.removeIf { it.key == entityKey }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE",
                "Removed output entity '${entityKey}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    void deleteProcess(String key, User currentUser) {
        Process process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        // Check if this process is referenced in any diagram element
        def elemRepo = this.processElementRepository
        List references = elemRepo.findByLinkedProcessId(process.id)
        if (!references.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot delete process: it is referenced in ${references.size()} diagram element(s)")
        }

        processRepository.delete(process)
    }

    @Transactional
    List<ProcessVersionResponse> getVersionHistory(String key) {
        Process process = getProcessByKey(key)
        def m = this.processMapper
        return processVersionRepository.findByProcessIdOrderByVersionNumberDesc(process.id)
                .collect { m.toProcessVersionResponse(it) }
    }

    @Transactional
    VersionDiffResponse getVersionDiff(String key, Integer versionNumber) {
        Process process = getProcessByKey(key)

        ProcessVersion currentVersion = processVersionRepository
                .findByProcessIdAndVersionNumber(process.id, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"))

        ProcessVersion previousVersion = null
        if (versionNumber > 1) {
            previousVersion = processVersionRepository
                    .findByProcessIdAndVersionNumber(process.id, versionNumber - 1)
                    .orElse(null)
        }

        Map<String, Object> currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        Map<String, Object> previousSnapshot = previousVersion != null
                ? parseSnapshot(previousVersion.snapshotJson)
                : [:]

        List<FieldChange> changes = calculateDiff(previousSnapshot, currentSnapshot)

        return new VersionDiffResponse(
                versionNumber,
                previousVersion?.versionNumber,
                changes
        )
    }

    @Transactional
    void recordVersion(String key, User changedBy, String changeType, String changeSummary) {
        Process process = getProcessByKey(key)
        createProcessVersion(process, changedBy, changeType, changeSummary)
    }

    private BusinessEntity resolveOrCreateEntity(AddProcessEntityRequest request, User currentUser) {
        if (request.entityKey != null) {
            return businessEntityRepository.findByKey(request.entityKey)
                    .orElseThrow(() -> new ResourceNotFoundException("Business entity not found: ${request.entityKey}"))
        } else if (request.createEntity != null) {
            def bes = this.businessEntityService
            return bes.createBusinessEntity(request.createEntity, currentUser)
        } else {
            throw new IllegalArgumentException("Either entityKey or createEntity must be provided")
        }
    }

    static void checkEditPermission(Process process, User currentUser) {
        boolean isOwner = process.processOwner.id == currentUser.id
        boolean isAdmin = currentUser.roles?.contains("ROLE_ADMIN")

        if (!isOwner && !isAdmin) {
            throw new ForbiddenOperationException(
                    "Only the process owner or an admin can edit this process")
        }
    }

    private void validateTranslations(List<org.leargon.backend.model.LocalizedText> translations, boolean requireDefault = true) {
        if (translations == null || translations.isEmpty()) {
            if (requireDefault) {
                throw new IllegalArgumentException("At least one translation is required")
            }
            return
        }

        def ls = this.localeService
        def defaultLocale = ls.getDefaultLocale()
        if (defaultLocale == null) {
            throw new IllegalStateException("No default locale configured")
        }

        translations.each { translation ->
            if (!ls.isLocaleActive(translation.locale)) {
                throw new IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text == null || translation.text.trim().isEmpty()) {
                throw new IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            def defaultTranslation = translations.find { it.locale == defaultLocale.localeCode }
            if (defaultTranslation == null) {
                throw new IllegalArgumentException(
                        "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required")
            }
        }
    }

    private void createProcessVersion(Process process, User changedBy, String changeType, String changeSummary) {
        Integer nextVersion = processVersionRepository
                .findFirstByProcessIdOrderByVersionNumberDesc(process.id)
                .map { it.versionNumber + 1 }
                .orElse(1)

        Map<String, Object> snapshot = [
                key                 : process.key,
                code                : process.code,
                processType         : process.processType,
                processOwnerUsername: process.processOwner.username,
                names               : process.names.collect {
                    [locale: it.locale, text: it.text]
                },
                descriptions        : process.descriptions.collect {
                    [locale: it.locale, text: it.text]
                }
        ]

        ProcessVersion version = new ProcessVersion()
        version.process = process
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = JsonOutput.toJson(snapshot)
        version.changeSummary = changeSummary

        processVersionRepository.save(version)
    }

    private static List<FieldChange> calculateDiff(Map<String, Object> previous, Map<String, Object> current) {
        List<FieldChange> changes = []

        if (previous == null) previous = [:]
        if (current == null) current = [:]

        // Compare process owner
        def prevOwner = previous?.get('processOwnerUsername')
        def currOwner = current?.get('processOwnerUsername')
        if (prevOwner != currOwner) {
            changes << new FieldChange("processOwner", prevOwner?.toString(), currOwner?.toString())
        }

        // Compare code
        def prevCode = previous?.get('code')
        def currCode = current?.get('code')
        if (prevCode != currCode) {
            changes << new FieldChange("code", prevCode?.toString(), currCode?.toString())
        }

        // Compare process type
        def prevType = previous?.get('processType')
        def currType = current?.get('processType')
        if (prevType != currType) {
            changes << new FieldChange("processType", prevType?.toString(), currType?.toString())
        }

        // Compare names
        List<Map> prevNames = (previous?.get('names') ?: []) as List<Map>
        List<Map> currNames = (current?.get('names') ?: []) as List<Map>

        Set<String> allNameLocales = (prevNames*.locale + currNames*.locale).toSet() as Set<String>
        allNameLocales.each { locale ->
            Map prev = prevNames.find { it.locale == locale }
            Map curr = currNames.find { it.locale == locale }

            if (prev == null && curr != null) {
                changes << new FieldChange("name.${locale}", null, curr.text?.toString())
            } else if (prev != null && curr == null) {
                changes << new FieldChange("name.${locale}", prev.text?.toString(), null)
            } else if (prev != null && curr != null && prev.text != curr.text) {
                changes << new FieldChange("name.${locale}", prev.text?.toString(), curr.text?.toString())
            }
        }

        // Compare descriptions
        List<Map> prevDescs = (previous?.get('descriptions') ?: []) as List<Map>
        List<Map> currDescs = (current?.get('descriptions') ?: []) as List<Map>

        Set<String> allDescLocales = (prevDescs*.locale + currDescs*.locale).toSet() as Set<String>
        allDescLocales.each { locale ->
            Map prev = prevDescs.find { it.locale == locale }
            Map curr = currDescs.find { it.locale == locale }

            if (prev == null && curr != null) {
                changes << new FieldChange("description.${locale}", null, curr.text?.toString())
            } else if (prev != null && curr == null) {
                changes << new FieldChange("description.${locale}", prev.text?.toString(), null)
            } else if (prev != null && curr != null && prev.text != curr.text) {
                changes << new FieldChange("description.${locale}", prev.text?.toString(), curr.text?.toString())
            }
        }

        return changes
    }

    private Map<String, Object> parseSnapshot(String json) {
        def parsed = jsonSlurper.parseText(json)
        if (parsed instanceof String) {
            parsed = jsonSlurper.parseText(parsed)
        }
        return parsed as Map<String, Object>
    }
}
