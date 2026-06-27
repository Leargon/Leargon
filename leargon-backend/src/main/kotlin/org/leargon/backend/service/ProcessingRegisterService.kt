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

    private fun rootEntity(e: BusinessEntity): BusinessEntity = if (e.parent == null) e else rootEntity(e.parent!!)

    private fun collectEffectiveTransfers(process: Process): List<CrossBorderTransfer> {
        val seen = mutableSetOf<String>()
        val result = mutableListOf<CrossBorderTransfer>()

        fun collect(p: Process) {
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

        return allProcesses
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

        val roleEntities =
            allEntities.filter { e ->
                e.classificationAssignments.any {
                    it.classificationKey == "entity-type" && it.valueKey == "entity-type--role"
                } &&
                    e.classificationAssignments.any {
                        it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                    }
            }
        val personCategories =
            roleEntities.map { rootEntity(it) }.distinctBy { it.key }.joinToString("; ") { localizedName(it, locale) }

        val personalDataEntities =
            allEntities.filter { e ->
                e.classificationAssignments.any {
                    it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                } &&
                    e.classificationAssignments.none {
                        it.classificationKey == "entity-type" && it.valueKey == "entity-type--role"
                    }
            }
        val dataCategories =
            personalDataEntities
                .map { rootEntity(it) }
                .distinctBy { it.key }
                .joinToString("; ") { localizedName(it, locale) }

        val retentionEntities = allEntities.filter { !it.retentionPeriod.isNullOrBlank() }
        val retentionPeriods =
            retentionEntities.joinToString("; ") { e ->
                "${localizedName(e, locale)}: ${e.retentionPeriod}"
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
