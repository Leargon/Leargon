package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.CrossBorderTransfer
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.User
import org.leargon.backend.mapper.ProcessMapper
import org.leargon.backend.mapper.ProcessMapper.Companion.derivedProcessingCountries
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.ProcessingRegisterEntryResponse
import org.leargon.backend.repository.OrganisationSettingsRepository
import org.leargon.backend.repository.ProcessRepository
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Singleton
open class ProcessingRegisterService(
    private val processRepository: ProcessRepository,
    private val organisationSettingsRepository: OrganisationSettingsRepository,
    private val fieldConfigurationService: FieldConfigurationService,
) {
    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    private fun rootEntity(e: BusinessEntity): BusinessEntity {
        // Walk up to the top-level ancestor, guarding against accidental cycles in the data.
        val visited = mutableSetOf<String>()
        var current = e
        while (current.parent != null && visited.add(current.key)) {
            current = current.parent!!
        }
        return current
    }

    private fun collectEffectiveTransfers(process: Process): List<CrossBorderTransfer> {
        val seen = mutableSetOf<String>()
        val visitedProcesses = mutableSetOf<String>()
        val result = mutableListOf<CrossBorderTransfer>()

        fun collect(p: Process) {
            if (!visitedProcesses.add(p.key)) return
            p.crossBorderTransfers?.forEach { t ->
                if (seen.add("${t.destinationCountry}:${t.safeguard}")) result.add(t)
            }
            p.children.forEach { collect(it) }
        }
        collect(process)
        return result
    }

    private fun localizedName(
        entity: BusinessEntity,
        locale: String
    ): String = entity.names.find { it.locale == locale }?.text ?: entity.names.firstOrNull()?.text ?: entity.key

    private fun canEdit(
        process: Process,
        currentUser: User
    ): Boolean {
        val isOwner = process.effectiveOwner()?.id == currentUser.id
        val isSteward = process.effectiveSteward()?.id == currentUser.id
        val isAdmin = currentUser.roles.contains("ROLE_ADMIN")
        return isOwner || isSteward || isAdmin
    }

    private fun missingFields(process: Process): List<String>? {
        val fc =
            fieldConfigurationService.compute("BUSINESS_PROCESS") { fieldName ->
                when {
                    fieldName == "names" -> {
                        process.names.isNotEmpty()
                    }

                    fieldName == "descriptions" -> {
                        process.descriptions.isNotEmpty()
                    }

                    fieldName == "boundedContext" -> {
                        process.boundedContext != null
                    }

                    fieldName == "processOwner" -> {
                        process.effectiveOwner() != null
                    }

                    fieldName == "executingUnits" -> {
                        process.executingUnits.isNotEmpty()
                    }

                    fieldName == "legalBasis" -> {
                        process.legalBasis != null
                    }

                    fieldName.startsWith("names.") -> {
                        val l = fieldName.removePrefix("names.")
                        process.names.any { it.locale == l && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("descriptions.") -> {
                        val l = fieldName.removePrefix("descriptions.")
                        process.descriptions.any { it.locale == l && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("classification.") -> {
                        val classKey = fieldName.removePrefix("classification.")
                        process.classificationAssignments.any { it.classificationKey == classKey }
                    }

                    else -> {
                        true
                    }
                }
            }
        return fc.missing?.takeIf { it.isNotEmpty() }
    }

    @Transactional
    open fun getEntries(
        locale: String,
        currentUser: User
    ): List<ProcessingRegisterEntryResponse> {
        val orgSettings = organisationSettingsRepository.findFirst().orElse(null)
        val euRepresentative = orgSettings?.euRepresentative ?: ""
        val dpo = orgSettings?.dataProtectionOfficer ?: ""
        val homeCountry = orgSettings?.homeCountry

        val allProcesses = processRepository.findAll()
        val childKeysByParent =
            allProcesses
                .filter { it.parent != null }
                .groupBy { it.parent!!.key }

        // One row per *root* process — the Art. 30 / revDSG "processing activity". Sub-processes
        // aggregate into their root's row (see roll-up helpers) rather than repeating as their own rows.
        return allProcesses
            .filter { it.parent == null }
            .map { process -> buildEntry(process, locale, euRepresentative, dpo, homeCountry, currentUser, childKeysByParent) }
    }

    private fun buildEntry(
        process: Process,
        locale: String,
        euRepresentative: String,
        dpo: String,
        homeCountry: String?,
        currentUser: User,
        childKeysByParent: Map<String, List<Process>>,
    ): ProcessingRegisterEntryResponse {
        val allEntities =
            (
                ProcessMapper.collectEffectiveEntities(process) { it.inputEntities } +
                    ProcessMapper.collectEffectiveEntities(process) { it.outputEntities }
            ).distinctBy { it.key }

        val owningUnitNames = process.owningUnit?.names
        val lastModified = process.updatedAt?.atZone(ZoneOffset.UTC)?.format(dateFormatter)
        val changedBy = process.updatedBy?.let { "${it.firstName} ${it.lastName}".trim() } ?: ""
        val department =
            owningUnitNames?.find { it.locale == locale }?.text ?: owningUnitNames?.firstOrNull()?.text ?: ""
        val name =
            process.names.find { it.locale == locale }?.text ?: process.names.firstOrNull()?.text ?: process.key
        val responsible = process.effectiveOwner()?.let { "${it.firstName} ${it.lastName}".trim() } ?: ""

        // Categories of data subjects (Art. 30(1)(c)) — personal-data entities marked DATA_SUBJECT.
        val roleEntities =
            allEntities.filter { it.containsPersonalData == true && it.entityRole == "DATA_SUBJECT" }
        val personCategories =
            roleEntities.map { rootEntity(it) }.distinctBy { it.key }.joinToString("; ") { localizedName(it, locale) }

        // Categories of personal data — personal-data entities that are not data-subject categories.
        val personalDataEntities =
            allEntities.filter { it.containsPersonalData == true && it.entityRole != "DATA_SUBJECT" }
        val dataCategories =
            personalDataEntities
                .map { rootEntity(it) }
                .distinctBy { it.key }
                .joinToString("; ") { localizedName(it, locale) }

        val retentionEntities = allEntities.filter { it.retentionPeriod.isNotEmpty() }
        val retentionPeriods =
            retentionEntities.joinToString("; ") { e ->
                val rp =
                    e.retentionPeriod.find { it.locale == locale }?.text
                        ?: e.retentionPeriod.firstOrNull()?.text ?: ""
                "${localizedName(e, locale)}: $rp"
            }

        val recipients =
            process.serviceProviders.joinToString("; ") {
                it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
            }

        val transfers =
            collectEffectiveTransfers(process)
                .filter { homeCountry == null || it.destinationCountry != homeCountry }
                .joinToString("; ") { "${it.destinationCountry}: ${it.safeguard}" }

        val processingCountries = derivedProcessingCountries(process).joinToString("; ")

        val purposeLocalized = process.purpose?.find { it.locale == locale }?.text
        val purposes = purposeLocalized ?: process.purpose?.firstOrNull()?.text ?: ""

        val secMeasuresLocalized = process.securityMeasures?.find { it.locale == locale }?.text
        val securityMeasures = secMeasuresLocalized ?: process.securityMeasures?.firstOrNull()?.text ?: ""

        val hasChildren = childKeysByParent.containsKey(process.key)

        return ProcessingRegisterEntryResponse(
            process.key,
            hasChildren,
            canEdit(process, currentUser),
            changedBy,
            department,
            name,
            responsible,
            euRepresentative,
            dpo,
            "",
            purposes,
            personCategories,
            dataCategories,
            recipients,
            transfers,
            retentionPeriods,
            securityMeasures,
        ).processingCountries(processingCountries)
            .parentKey(process.parent?.key)
            .lastModified(lastModified)
            .purposeRaw(process.purpose?.map { LocalizedText(it.locale, it.text) })
            .securityMeasuresRaw(process.securityMeasures?.map { LocalizedText(it.locale, it.text) })
            .missingMandatoryFields(missingFields(process))
    }
}
