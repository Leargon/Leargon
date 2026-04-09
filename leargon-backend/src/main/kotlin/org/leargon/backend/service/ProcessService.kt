package org.leargon.backend.service

import com.fasterxml.jackson.databind.ObjectMapper
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
import org.leargon.backend.model.AddProcessEntityRequest
import org.leargon.backend.model.CreateProcessRequest
import org.leargon.backend.model.FieldChange
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessTreeResponse
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.VersionDiffResponse
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.DomainEventProcessLinkRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessFlowNodeRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.util.SlugUtil

@Singleton
open class ProcessService(
    private val processRepository: ProcessRepository,
    private val processVersionRepository: ProcessVersionRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val userRepository: UserRepository,
    private val localeService: LocaleService,
    private val processMapper: ProcessMapper,
    private val businessEntityService: BusinessEntityService,
    private val domainEventProcessLinkRepository: DomainEventProcessLinkRepository,
    private val dpiaRepository: DpiaRepository,
    private val processFlowNodeRepository: ProcessFlowNodeRepository
) {
    private val objectMapper = ObjectMapper()

    @Transactional
    open fun getAllProcessesAsResponses(): List<ProcessResponse> = processRepository.findAll().map { processMapper.toProcessResponse(it) }

    @Transactional
    open fun getProcessTreeAsResponses(): List<ProcessTreeResponse> {
        val roots = processRepository.findByParentIsNull()
        return processMapper.toProcessTreeResponses(roots)
    }

    open fun getProcessByKey(key: String): Process =
        processRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("Process not found") }

    @Transactional
    open fun getProcessByKeyAsResponse(key: String): ProcessResponse = processMapper.toProcessResponse(getProcessByKey(key))

    @Transactional
    open fun createProcess(
        request: CreateProcessRequest,
        currentUser: User
    ): Process {
        validateTranslations(request.names)
        if (request.descriptions != null) {
            validateTranslations(request.descriptions, false)
        }

        var process = Process()
        process.createdBy = currentUser

        process.processOwner =
            if (request.processOwnerUsername != null) {
                userRepository
                    .findByUsername(request.processOwnerUsername)
                    .orElseThrow { ResourceNotFoundException("Process owner user not found") }
            } else {
                currentUser
            }

        process.names = request.names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        if (request.descriptions != null) {
            process.descriptions = request.descriptions!!.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        }

        if (request.code != null) {
            process.code = request.code
        }

        if (request.processType != null) {
            process.processType = request.processType!!.value
        }

        val defaultLocale = localeService.getDefaultLocale()
        process.key =
            if (!process.code.isNullOrBlank()) {
                SlugUtil.slugify(process.code)
            } else {
                val defaultName = process.names.find { it.locale == defaultLocale?.localeCode }?.text
                SlugUtil.slugify(defaultName)
            }

        if (request.parentProcessKey != null) {
            val parentProcess =
                processRepository
                    .findByKey(request.parentProcessKey)
                    .orElseThrow { ResourceNotFoundException("Parent process not found: ${request.parentProcessKey}") }
            process.parent = parentProcess
        }

        if (request.inputEntityKeys != null) {
            for (entityKey in request.inputEntityKeys!!) {
                val entity =
                    businessEntityRepository
                        .findByKey(entityKey)
                        .orElseThrow { ResourceNotFoundException("Input entity not found: $entityKey") }
                process.inputEntities.add(entity)
            }
        }

        if (request.outputEntityKeys != null) {
            for (entityKey in request.outputEntityKeys!!) {
                val entity =
                    businessEntityRepository
                        .findByKey(entityKey)
                        .orElseThrow { ResourceNotFoundException("Output entity not found: $entityKey") }
                process.outputEntities.add(entity)
            }
        }

        process = processRepository.save(process)
        createProcessVersion(process, currentUser, "CREATE", "Initial creation")
        return process
    }

    @Transactional
    open fun updateProcessNames(
        key: String,
        names: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        validateTranslations(names)

        process.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

        if (process.code.isNullOrBlank()) {
            val defaultLocale = localeService.getDefaultLocale()
            val defaultName = process.names.find { it.locale == defaultLocale?.localeCode }?.text
            process.key = SlugUtil.slugify(defaultName)
        }

        val newKey = process.key
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated names")

        if (newKey != key) updateDiagramReferences(key, newKey)

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessDescriptions(
        key: String,
        descriptions: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        validateTranslations(descriptions, false)

        process.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated descriptions")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateLegalBasis(
        key: String,
        legalBasis: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val oldBasis = process.legalBasis ?: "none"
        process.legalBasis = legalBasis

        process = processRepository.update(process)
        createProcessVersion(
            process,
            currentUser,
            "UPDATE",
            "Changed legal basis from '$oldBasis' to '${legalBasis ?: "none"}'"
        )

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updatePurpose(
        key: String,
        purpose: List<org.leargon.backend.model.LocalizedText>?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)
        val domainPurpose =
            purpose
                ?.map {
                    org.leargon.backend.domain
                        .LocalizedText(it.locale, it.text)
                }?.toMutableList()
        process.purpose = domainPurpose
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated purpose")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateSecurityMeasures(
        key: String,
        securityMeasures: List<org.leargon.backend.model.LocalizedText>?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)
        val domainMeasures =
            securityMeasures
                ?.map {
                    org.leargon.backend.domain
                        .LocalizedText(it.locale, it.text)
                }?.toMutableList()
        process.securityMeasures = domainMeasures
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated security measures")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessType(
        key: String,
        processType: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val oldType = process.processType ?: "none"
        process.processType = processType

        process = processRepository.update(process)
        createProcessVersion(
            process,
            currentUser,
            "TYPE_CHANGE",
            "Changed process type from '$oldType' to '${processType ?: "none"}'"
        )

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessParent(
        key: String,
        parentKey: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        if (parentKey != null) {
            if (parentKey == key) throw IllegalArgumentException("A process cannot be its own parent")
            val newParent = getProcessByKey(parentKey)
            process.parent = newParent
        } else {
            process.parent = null
        }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Changed parent to ${parentKey ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessOwner(
        key: String,
        ownerUsername: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val newOwner =
            userRepository
                .findByUsername(ownerUsername)
                .orElseThrow { ResourceNotFoundException("Process owner user not found") }
        process.processOwner = newOwner

        process = processRepository.update(process)
        createProcessVersion(
            process,
            currentUser,
            "OWNER_CHANGE",
            "Changed process owner to ${newOwner.username}"
        )

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun clearProcessOwner(
        key: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        if (process.boundedContext?.owningUnit?.businessOwner == null) {
            throw IllegalArgumentException(
                "Cannot clear explicit process owner: no computed owner available from the bounded context's owning unit"
            )
        }
        process.processOwner = null
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "OWNER_CHANGE", "Cleared explicit process owner (reverted to computed)")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessSteward(
        key: String,
        stewardUsername: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.processSteward =
            if (stewardUsername != null) {
                userRepository
                    .findByUsername(stewardUsername)
                    .orElseThrow { ResourceNotFoundException("Process steward user not found: $stewardUsername") }
            } else {
                null
            }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated process steward to ${stewardUsername ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessTechnicalCustodian(
        key: String,
        custodianUsername: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.technicalCustodian =
            if (custodianUsername != null) {
                userRepository
                    .findByUsername(custodianUsername)
                    .orElseThrow { ResourceNotFoundException("Technical custodian user not found: $custodianUsername") }
            } else {
                null
            }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated technical custodian to ${custodianUsername ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateProcessCode(
        key: String,
        code: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        if (!code.isNullOrBlank()) {
            process.code = code
            process.key = SlugUtil.slugify(code)
        } else {
            process.code = null
        }

        val newKey = process.key
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated code to '${code ?: "none"}'")

        if (newKey != key) updateDiagramReferences(key, newKey)

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun updateCrossBorderTransfers(
        processKey: String,
        transfers: List<org.leargon.backend.model.CrossBorderTransferEntry>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(processKey)
        checkEditPermission(process, currentUser)
        process.crossBorderTransfers =
            transfers
                .map {
                    org.leargon.backend.mapper.CrossBorderTransferMapper
                        .fromCrossBorderTransferEntry(it)
                }.toMutableList()
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated cross-border transfers")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun assignBoundedContext(
        key: String,
        boundedContextKey: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val oldName = process.boundedContext?.getName("en") ?: "none"

        process.boundedContext =
            if (boundedContextKey != null) {
                boundedContextRepository
                    .findByKey(boundedContextKey)
                    .orElseThrow { ResourceNotFoundException("Bounded context not found") }
            } else {
                null
            }

        process = processRepository.update(process)

        val newName = process.boundedContext?.getName("en") ?: "none"
        createProcessVersion(
            process,
            currentUser,
            "UPDATE",
            "BoundedContext assignment changed from '$oldName' to '$newName'"
        )

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun addInput(
        key: String,
        request: AddProcessEntityRequest,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val entity = resolveOrCreateEntity(request, currentUser)
        process.inputEntities.add(entity)

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Added input entity '${entity.key}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun removeInput(
        key: String,
        entityKey: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.inputEntities.removeIf { it.key == entityKey }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Removed input entity '$entityKey'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun addOutput(
        key: String,
        request: AddProcessEntityRequest,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        val entity = resolveOrCreateEntity(request, currentUser)
        process.outputEntities.add(entity)

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Added output entity '${entity.key}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun removeOutput(
        key: String,
        entityKey: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.outputEntities.removeIf { it.key == entityKey }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Removed output entity '$entityKey'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun assignExecutingUnits(
        key: String,
        unitKeys: List<String>?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        process.executingUnits.clear()

        if (unitKeys != null) {
            for (unitKey in unitKeys) {
                val unit =
                    organisationalUnitRepository
                        .findByKey(unitKey)
                        .orElseThrow { ResourceNotFoundException("Organisational unit not found: $unitKey") }
                process.executingUnits.add(unit)
            }
        }

        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated executing units")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Transactional
    open fun deleteProcess(
        key: String,
        currentUser: User
    ) {
        val process = getProcessByKey(key)
        checkEditPermission(process, currentUser)

        if (process.children.isNotEmpty()) {
            throw IllegalArgumentException(
                "Cannot delete process: it has ${process.children.size} child process(es). Delete or reassign them first."
            )
        }

        // Block deletion if referenced as a linked process in another process's flow
        if (processFlowNodeRepository.existsByLinkedProcessKey(process.key)) {
            val referencingKeys =
                processFlowNodeRepository
                    .findByLinkedProcessKey(process.key)
                    .map { it.processKey }
                    .distinct()
                    .take(3)
                    .joinToString(", ")
            throw IllegalArgumentException(
                "Cannot delete process '${process.key}': it is referenced as a sub-process in: $referencingKeys"
            )
        }

        // Nullify DPIA process reference if any
        dpiaRepository.findByProcessId(process.id!!).ifPresent { dpia ->
            dpia.process = null
            dpiaRepository.update(dpia)
        }

        // Remove domain event links referencing this process
        domainEventProcessLinkRepository.deleteByProcessId(process.id!!)

        processRepository.delete(process)
    }

    @Transactional
    open fun getVersionHistory(key: String): List<ProcessVersionResponse> {
        val process = getProcessByKey(key)
        return processVersionRepository
            .findByProcessIdOrderByVersionNumberDesc(process.id!!)
            .map { processMapper.toProcessVersionResponse(it) }
    }

    @Transactional
    open fun getVersionDiff(
        key: String,
        versionNumber: Int
    ): VersionDiffResponse {
        val process = getProcessByKey(key)

        val currentVersion =
            processVersionRepository
                .findByProcessIdAndVersionNumber(process.id!!, versionNumber)
                .orElseThrow { ResourceNotFoundException("Version not found") }

        val previousVersion =
            if (versionNumber > 1) {
                processVersionRepository
                    .findByProcessIdAndVersionNumber(process.id!!, versionNumber - 1)
                    .orElse(null)
            } else {
                null
            }

        val currentSnapshot = parseSnapshot(currentVersion.snapshotJson)
        val previousSnapshot = if (previousVersion != null) parseSnapshot(previousVersion.snapshotJson) else emptyMap()

        val changes = calculateDiff(previousSnapshot, currentSnapshot)

        return VersionDiffResponse(versionNumber, previousVersion?.versionNumber, changes)
    }

    @Transactional
    open fun recordVersion(
        key: String,
        changedBy: User,
        changeType: String,
        changeSummary: String
    ) {
        val process = getProcessByKey(key)
        createProcessVersion(process, changedBy, changeType, changeSummary)
    }

    private fun resolveOrCreateEntity(
        request: AddProcessEntityRequest,
        currentUser: User
    ): BusinessEntity =
        when {
            request.entityKey != null -> {
                businessEntityRepository
                    .findByKey(request.entityKey)
                    .orElseThrow { ResourceNotFoundException("Business entity not found: ${request.entityKey}") }
            }

            request.createEntity != null -> {
                businessEntityService.createBusinessEntity(request.createEntity!!, currentUser)
            }

            else -> {
                throw IllegalArgumentException("Either entityKey or createEntity must be provided")
            }
        }

    private fun validateTranslations(
        translations: List<org.leargon.backend.model.LocalizedText>?,
        requireDefault: Boolean = true
    ) {
        if (translations.isNullOrEmpty()) {
            if (requireDefault) throw IllegalArgumentException("At least one translation is required")
            return
        }

        val defaultLocale =
            localeService.getDefaultLocale()
                ?: throw IllegalStateException("No default locale configured")

        translations.forEach { translation ->
            if (!localeService.isLocaleActive(translation.locale)) {
                throw IllegalArgumentException("Unsupported locale: ${translation.locale}")
            }
            if (translation.text.isNullOrBlank()) {
                throw IllegalArgumentException("Text is required for locale: ${translation.locale}")
            }
        }

        if (requireDefault) {
            val defaultTranslation = translations.find { it.locale == defaultLocale.localeCode }
            if (defaultTranslation == null) {
                throw IllegalArgumentException(
                    "Translation for default locale '${defaultLocale.localeCode}' (${defaultLocale.displayName}) is required"
                )
            }
        }
    }

    private fun updateDiagramReferences(
        oldKey: String,
        newKey: String
    ) {
        processFlowNodeRepository.findByLinkedProcessKey(oldKey).forEach { node ->
            node.linkedProcessKey = newKey
            processFlowNodeRepository.update(node)
        }
    }

    private fun createProcessVersion(
        process: Process,
        changedBy: User,
        changeType: String,
        changeSummary: String
    ) {
        val nextVersion =
            processVersionRepository
                .findFirstByProcessIdOrderByVersionNumberDesc(process.id!!)
                .map { it.versionNumber + 1 }
                .orElse(1)

        val snapshot =
            mapOf(
                "key" to process.key,
                "code" to process.code,
                "processType" to process.processType,
                "legalBasis" to process.legalBasis,
                "processOwnerUsername" to process.processOwner?.username,
                "names" to process.names.map { mapOf("locale" to it.locale, "text" to it.text) },
                "descriptions" to process.descriptions.map { mapOf("locale" to it.locale, "text" to it.text) }
            )

        val version = ProcessVersion()
        version.process = process
        version.versionNumber = nextVersion
        version.changedBy = changedBy
        version.changeType = changeType
        version.snapshotJson = objectMapper.writeValueAsString(snapshot)
        version.changeSummary = changeSummary

        processVersionRepository.save(version)
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseSnapshot(json: String): Map<String, Any?> {
        var parsed = objectMapper.readValue(json, Any::class.java)
        if (parsed is String) {
            parsed = objectMapper.readValue(parsed, Any::class.java)
        }
        return parsed as Map<String, Any?>
    }

    companion object {
        @JvmStatic
        fun checkEditPermission(
            process: Process,
            currentUser: User
        ) {
            val effectiveOwner = process.processOwner ?: process.boundedContext?.owningUnit?.businessOwner
            val isOwner = effectiveOwner?.id == currentUser.id
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            if (!isOwner && !isAdmin) {
                throw ForbiddenOperationException("Only the process owner or an admin can edit this process")
            }
        }

        @JvmStatic
        @Suppress("UNCHECKED_CAST")
        fun calculateDiff(
            previous: Map<String, Any?>,
            current: Map<String, Any?>
        ): List<FieldChange> {
            val changes = mutableListOf<FieldChange>()

            val prevOwner = previous["processOwnerUsername"]
            val currOwner = current["processOwnerUsername"]
            if (prevOwner != currOwner) {
                changes.add(FieldChange("processOwner", prevOwner?.toString(), currOwner?.toString()))
            }

            val prevCode = previous["code"]
            val currCode = current["code"]
            if (prevCode != currCode) {
                changes.add(FieldChange("code", prevCode?.toString(), currCode?.toString()))
            }

            val prevType = previous["processType"]
            val currType = current["processType"]
            if (prevType != currType) {
                changes.add(FieldChange("processType", prevType?.toString(), currType?.toString()))
            }

            val prevBasis = previous["legalBasis"]
            val currBasis = current["legalBasis"]
            if (prevBasis != currBasis) {
                changes.add(FieldChange("legalBasis", prevBasis?.toString(), currBasis?.toString()))
            }

            val prevNames = (previous["names"] as? List<Map<*, *>>) ?: emptyList()
            val currNames = (current["names"] as? List<Map<*, *>>) ?: emptyList()
            val allNameLocales =
                (prevNames.map { it["locale"]?.toString() } + currNames.map { it["locale"]?.toString() })
                    .filterNotNull()
                    .toSet()
            allNameLocales.forEach { locale ->
                val prev = prevNames.find { it["locale"] == locale }
                val curr = currNames.find { it["locale"] == locale }
                if (prev == null && curr != null) {
                    changes.add(FieldChange("name.$locale", null, curr["text"]?.toString()))
                } else if (prev != null && curr == null) {
                    changes.add(FieldChange("name.$locale", prev["text"]?.toString(), null))
                } else if (prev != null && curr != null && prev["text"] != curr["text"]) {
                    changes.add(FieldChange("name.$locale", prev["text"]?.toString(), curr["text"]?.toString()))
                }
            }

            val prevDescs = (previous["descriptions"] as? List<Map<*, *>>) ?: emptyList()
            val currDescs = (current["descriptions"] as? List<Map<*, *>>) ?: emptyList()
            val allDescLocales =
                (prevDescs.map { it["locale"]?.toString() } + currDescs.map { it["locale"]?.toString() })
                    .filterNotNull()
                    .toSet()
            allDescLocales.forEach { locale ->
                val prev = prevDescs.find { it["locale"] == locale }
                val curr = currDescs.find { it["locale"] == locale }
                if (prev == null && curr != null) {
                    changes.add(FieldChange("description.$locale", null, curr["text"]?.toString()))
                } else if (prev != null && curr == null) {
                    changes.add(FieldChange("description.$locale", prev["text"]?.toString(), null))
                } else if (prev != null && curr != null && prev["text"] != curr["text"]) {
                    changes.add(FieldChange("description.$locale", prev["text"]?.toString(), curr["text"]?.toString()))
                }
            }

            return changes
        }
    }
}
