package org.leargon.backend.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.micronaut.retry.annotation.Retryable
import io.micronaut.transaction.annotation.ReadOnly
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
    private val processFlowNodeRepository: ProcessFlowNodeRepository,
    private val fieldVerificationService: FieldVerificationService,
    private val roleService: RoleService,
    private val processFieldValueExtractor: org.leargon.backend.service.fieldvalue.ProcessFieldValueExtractor
) {
    private val objectMapper = ObjectMapper()

    /**
     * Per-field edit gate. Owner/steward/admin may edit anything; a methodology-scoped EDITOR/LEAD may
     * edit a field belonging to their methodology. Verification stays owner-only, so scoped edits land
     * UNVERIFIED automatically (sync uses the effective owner, not this check).
     */
    private fun requireFieldEdit(
        process: Process,
        currentUser: User,
        fieldName: String
    ) {
        val isOwner = process.effectiveOwner()?.id == currentUser.id
        val isSteward = process.effectiveSteward()?.id == currentUser.id
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        val rs = this.roleService
        if (isOwner || isSteward || isAdmin || rs.canEditFieldByRole(currentUser, "BUSINESS_PROCESS", fieldName)) return
        throw ForbiddenOperationException("You do not have permission to edit this field")
    }

    @ReadOnly
    open fun getAllProcessesAsResponses(): List<ProcessResponse> = processRepository.findAll().map { processMapper.toProcessResponse(it) }

    @ReadOnly
    open fun getProcessTreeAsResponses(): List<ProcessTreeResponse> {
        val roots = processRepository.findByParentIsNull()
        return processMapper.toProcessTreeResponses(roots)
    }

    open fun getProcessByKey(key: String): Process =
        processRepository
            .findByKey(key)
            .orElseThrow { ResourceNotFoundException("Process not found") }

    @ReadOnly
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

        // Create gating: root processes need admin / PROCESS_GOVERNANCE editor-lead; a child (sub-process)
        // may also be created by the parent process's owner or steward.
        val parentProcess =
            request.parentProcessKey?.let {
                processRepository
                    .findByKey(it)
                    .orElseThrow { ResourceNotFoundException("Parent process not found: $it") }
            }
        if (parentProcess != null) {
            roleService.requireCreateChild(
                currentUser, "PROCESS_GOVERNANCE", parentProcess.processOwner?.id, parentProcess.processSteward?.id
            )
        } else {
            roleService.requireCreateRoot(currentUser, "PROCESS_GOVERNANCE")
        }

        var process = Process()
        process.createdBy = currentUser
        process.updatedBy = currentUser

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

        if (parentProcess != null) {
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

        if (request.owningUnitKey != null) {
            process.owningUnit =
                organisationalUnitRepository
                    .findByKey(request.owningUnitKey!!)
                    .orElseThrow { ResourceNotFoundException("Owning unit not found") }
        }

        process = processRepository.save(process)
        createProcessVersion(process, currentUser, "CREATE", "Initial creation")
        return process
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessNames(
        key: String,
        names: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "names")

        validateTranslations(names)

        process.names = names.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()

        if (process.code.isNullOrBlank()) {
            val defaultLocale = localeService.getDefaultLocale()
            val defaultName = process.names.find { it.locale == defaultLocale?.localeCode }?.text
            process.key = SlugUtil.slugify(defaultName)
        }

        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated names")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessDescriptions(
        key: String,
        descriptions: List<org.leargon.backend.model.LocalizedText>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "descriptions")

        validateTranslations(descriptions, false)

        process.descriptions = descriptions.map { input -> LocalizedText(input.locale, input.text) }.toMutableList()
        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated descriptions")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateLegalBasis(
        key: String,
        legalBasis: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "legalBasis")

        val oldBasis = process.legalBasis ?: "none"
        process.legalBasis = legalBasis

        process.updatedBy = currentUser
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

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updatePurpose(
        key: String,
        purpose: List<org.leargon.backend.model.LocalizedText>?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "purpose")
        val domainPurpose =
            purpose
                ?.map {
                    org.leargon.backend.domain
                        .LocalizedText(it.locale, it.text)
                }?.toMutableList()
        process.purpose = domainPurpose
        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated purpose")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateSecurityMeasures(
        key: String,
        securityMeasures: List<org.leargon.backend.model.LocalizedText>?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "securityMeasures")
        val domainMeasures =
            securityMeasures
                ?.map {
                    org.leargon.backend.domain
                        .LocalizedText(it.locale, it.text)
                }?.toMutableList()
        process.securityMeasures = domainMeasures
        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated security measures")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessType(
        key: String,
        processType: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "processType")

        val oldType = process.processType ?: "none"
        process.processType = processType

        process.updatedBy = currentUser
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

    @Retryable(attempts = "3", delay = "100ms")
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

        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Changed parent to ${parentKey ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessOwner(
        key: String,
        ownerUsername: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "processOwner")

        val newOwner =
            userRepository
                .findByUsername(ownerUsername)
                .orElseThrow { ResourceNotFoundException("Process owner user not found") }
        process.processOwner = newOwner

        process.updatedBy = currentUser
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

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun clearProcessOwner(
        key: String,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "processOwner")

        val effectiveOwningUnit =
            process.owningUnit
                ?: process.boundedContext?.owningUnit
                ?: process.boundedContext?.domain?.owningUnit
        if (effectiveOwningUnit?.businessOwner == null) {
            throw IllegalArgumentException(
                "Cannot clear explicit process owner: no computed owner available from the owning unit or bounded context"
            )
        }
        process.processOwner = null
        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "OWNER_CHANGE", "Cleared explicit process owner (reverted to computed)")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessSteward(
        key: String,
        stewardUsername: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "processSteward")

        process.processSteward =
            if (stewardUsername != null) {
                userRepository
                    .findByUsername(stewardUsername)
                    .orElseThrow { ResourceNotFoundException("Process steward user not found: $stewardUsername") }
            } else {
                null
            }

        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated process steward to ${stewardUsername ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessTechnicalCustodian(
        key: String,
        custodianUsername: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "technicalCustodian")

        process.technicalCustodian =
            if (custodianUsername != null) {
                userRepository
                    .findByUsername(custodianUsername)
                    .orElseThrow { ResourceNotFoundException("Technical custodian user not found: $custodianUsername") }
            } else {
                null
            }

        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated technical custodian to ${custodianUsername ?: "none"}")
        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateProcessCode(
        key: String,
        code: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "code")

        if (!code.isNullOrBlank()) {
            process.code = code
            process.key = SlugUtil.slugify(code)
        } else {
            process.code = null
        }

        process.updatedBy = currentUser
        process = processRepository.update(process)
        createProcessVersion(process, currentUser, "UPDATE", "Updated code to '${code ?: "none"}'")

        process = getProcessByKey(process.key)
        return processMapper.toProcessResponse(process)
    }

    @Retryable(attempts = "3", delay = "100ms")
    @Transactional
    open fun updateCrossBorderTransfers(
        processKey: String,
        transfers: List<org.leargon.backend.model.CrossBorderTransferEntry>,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(processKey)
        requireFieldEdit(process, currentUser, "crossBorderTransfers")
        process.crossBorderTransfers =
            transfers
                .map {
                    org.leargon.backend.mapper.CrossBorderTransferMapper
                        .fromCrossBorderTransferEntry(it)
                }.toMutableList()
        process.updatedBy = currentUser
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
        requireFieldEdit(process, currentUser, "boundedContext")

        val oldName = process.boundedContext?.getName("en") ?: "none"

        process.boundedContext =
            if (boundedContextKey != null) {
                boundedContextRepository
                    .findByKey(boundedContextKey)
                    .orElseThrow { ResourceNotFoundException("Bounded context not found") }
            } else {
                null
            }

        process.updatedBy = currentUser
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
    open fun assignOwningUnit(
        key: String,
        owningUnitKey: String?,
        currentUser: User
    ): ProcessResponse {
        var process = getProcessByKey(key)
        requireFieldEdit(process, currentUser, "owningUnit")

        val oldName = process.owningUnit?.getName("en") ?: "none"

        process.owningUnit =
            if (owningUnitKey != null) {
                organisationalUnitRepository
                    .findByKey(owningUnitKey)
                    .orElseThrow { ResourceNotFoundException("Organisational unit not found") }
            } else {
                val fallbackOwner =
                    process.processOwner
                        ?: process.boundedContext
                            ?.owningUnit
                            ?.businessOwner
                        ?: process.boundedContext
                            ?.domain
                            ?.owningUnit
                            ?.businessOwner
                if (fallbackOwner == null) {
                    throw IllegalArgumentException(
                        "Cannot remove owning unit: no direct process owner or bounded context owner exists as fallback"
                    )
                }
                null
            }

        process.updatedBy = currentUser
        process = processRepository.update(process)

        val newName = process.owningUnit?.getName("en") ?: "none"
        createProcessVersion(
            process,
            currentUser,
            "UPDATE",
            "Owning unit assignment changed from '$oldName' to '$newName'"
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
        requireFieldEdit(process, currentUser, "inputEntities")

        val entity = resolveOrCreateEntity(request, currentUser)
        process.inputEntities.add(entity)

        process.updatedBy = currentUser
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
        requireFieldEdit(process, currentUser, "inputEntities")

        process.inputEntities.removeIf { it.key == entityKey }

        process.updatedBy = currentUser
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
        requireFieldEdit(process, currentUser, "outputEntities")

        val entity = resolveOrCreateEntity(request, currentUser)
        process.outputEntities.add(entity)

        process.updatedBy = currentUser
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
        requireFieldEdit(process, currentUser, "outputEntities")

        process.outputEntities.removeIf { it.key == entityKey }

        process.updatedBy = currentUser
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
        requireFieldEdit(process, currentUser, "executingUnits")

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

        process.updatedBy = currentUser
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
        roleService.requireDelete(currentUser, "BUSINESS_PROCESS", process.effectiveOwner()?.id, process.effectiveSteward()?.id)

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

        fieldVerificationService.deleteFor("BUSINESS_PROCESS", process.id!!)
        processRepository.delete(process)
    }

    @ReadOnly
    open fun getVersionHistory(key: String): List<ProcessVersionResponse> {
        val process = getProcessByKey(key)
        return processVersionRepository
            .findByProcessIdOrderByVersionNumberDesc(process.id!!)
            .map { processMapper.toProcessVersionResponse(it) }
    }

    @ReadOnly
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

        // Reconcile per-field verification status against the new values.
        val extractor = this.processFieldValueExtractor
        val fvs = this.fieldVerificationService
        val owner = process.effectiveOwner()
        val actorIsOwner = owner != null && owner.id == changedBy.id
        fvs.sync(
            "BUSINESS_PROCESS",
            process.id!!,
            changedBy,
            actorIsOwner,
            { fn -> extractor.value(process, fn) },
            extractor.collectionItemValues(process)
        )
    }

    @Transactional
    open fun setFieldVerification(
        key: String,
        fieldName: String,
        status: String,
        currentUser: User
    ): ProcessResponse {
        val process = getProcessByKey(key)
        val owner = process.effectiveOwner()
        if (owner == null || owner.id != currentUser.id) {
            throw ForbiddenOperationException("Only the process owner can set field verification status")
        }
        val ext = this.processFieldValueExtractor
        val currentValue = ext.collectionItemValues(process)[fieldName] ?: runCatching { ext.value(process, fieldName) }.getOrNull()
        fieldVerificationService.setStatus("BUSINESS_PROCESS", process.id!!, fieldName, status, currentUser, currentValue)
        return processMapper.toProcessResponse(getProcessByKey(key))
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
            val isOwner = process.effectiveOwner()?.id == currentUser.id
            val isSteward = process.effectiveSteward()?.id == currentUser.id
            val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
            if (!isOwner && !isSteward && !isAdmin) {
                throw ForbiddenOperationException("Only the process owner, steward, or an admin can edit this process")
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
