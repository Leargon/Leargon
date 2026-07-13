package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.ProcessVersion
import org.leargon.backend.model.ItSystemSummaryResponse
import org.leargon.backend.model.LegalBasis
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.model.ProcessTreeResponse
import org.leargon.backend.model.ProcessType
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.ProcessVersionResponseChangeType
import org.leargon.backend.repository.ProcessFlowNodeRepository
import org.leargon.backend.service.FieldConfigurationService
import org.leargon.backend.service.FieldVerificationService
import org.leargon.backend.service.MethodologyConfigurationService
import org.leargon.backend.service.RoleService
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class ProcessMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val serviceProviderMapper: ServiceProviderMapper,
    private val capabilityMapper: CapabilityMapper,
    private val processFlowNodeRepository: ProcessFlowNodeRepository,
    private val fieldVerificationService: FieldVerificationService,
    private val roleService: RoleService
) {
    fun toProcessResponse(
        process: Process,
        currentUser: org.leargon.backend.domain.User? = null
    ): ProcessResponse {
        val disabledMethodologies = methodologyConfigurationService.getDisabledMethodologies()
        val fc =
            fieldConfigurationService.compute("BUSINESS_PROCESS", disabledMethodologies) { fieldName ->
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
                        (
                            process.processOwner
                                ?: (process.owningUnit ?: process.boundedContext?.owningUnit ?: process.boundedContext?.domain?.owningUnit)
                                    ?.businessOwner
                        ) != null
                    }

                    fieldName == "executingUnits" -> {
                        process.executingUnits.isNotEmpty()
                    }

                    fieldName == "legalBasis" -> {
                        process.legalBasis != null
                    }

                    fieldName.startsWith("names.") -> {
                        val locale = fieldName.removePrefix("names.")
                        process.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("descriptions.") -> {
                        val locale = fieldName.removePrefix("descriptions.")
                        process.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("purpose.") -> {
                        val locale = fieldName.removePrefix("purpose.")
                        process.purpose?.any { it.locale == locale && !it.text.isNullOrBlank() } == true
                    }

                    fieldName.startsWith("securityMeasures.") -> {
                        val locale = fieldName.removePrefix("securityMeasures.")
                        process.securityMeasures?.any { it.locale == locale && !it.text.isNullOrBlank() } == true
                    }

                    fieldName.startsWith("classification.") -> {
                        val classKey = fieldName.removePrefix("classification.")
                        process.classificationAssignments.any { it.classificationKey == classKey }
                    }

                    fieldName.startsWith("activityJustification.") -> {
                        val locale = fieldName.removePrefix("activityJustification.")
                        process.activityJustification?.any { it.locale == locale && !it.text.isNullOrBlank() } == true
                    }

                    fieldName == "valueStreamType" -> {
                        !process.valueStreamType.isNullOrBlank()
                    }

                    fieldName == "cycleTimeMinutes" -> {
                        process.cycleTimeMinutes != null
                    }

                    fieldName == "waitTimeMinutes" -> {
                        process.waitTimeMinutes != null
                    }

                    fieldName == "changeoverTimeMinutes" -> {
                        process.changeoverTimeMinutes != null
                    }

                    fieldName == "frequencyCount" -> {
                        process.frequencyCount != null
                    }

                    fieldName == "activityType" -> {
                        !process.activityType.isNullOrBlank()
                    }

                    fieldName == "firstPassYield" -> {
                        process.firstPassYield != null
                    }

                    fieldName == "completionRate" -> {
                        process.completionRate != null
                    }

                    else -> {
                        true
                    }
                }
            }
        val effectiveOwningUnit =
            process.owningUnit
                ?: process.boundedContext?.owningUnit
                ?: process.boundedContext?.domain?.owningUnit
        val effectiveSteward = process.effectiveSteward()
        val effectiveCustodian = process.technicalCustodian ?: effectiveOwningUnit?.technicalCustodian
        val effectiveInputEntities = collectEffectiveEntities(process) { it.inputEntities }
        val effectiveOutputEntities = collectEffectiveEntities(process) { it.outputEntities }
        val allEffectiveEntities = (effectiveInputEntities + effectiveOutputEntities).distinctBy { it.key }
        val containsPersonalData = allEffectiveEntities.any { it.containsPersonalData == true }
        val fvSvc = this.fieldVerificationService
        val fieldStatuses =
            if (methodologyConfigurationService.isVerificationEnabled("BUSINESS_PROCESS")) {
                process.id?.let { id -> FieldVerificationMapper.toResponses(fvSvc.getStatuses("BUSINESS_PROCESS", id)) }
            } else {
                null
            }
        return ProcessResponse(
            process.key,
            process.processOwner != null,
            containsPersonalData,
            UserMapper.toUserSummary(process.createdBy),
            LocalizedTextMapper.toModel(process.names),
            LocalizedTextMapper.toModel(process.descriptions),
            toZonedDateTime(process.createdAt),
            toZonedDateTime(process.updatedAt)
        ).updatedBy(UserMapper.toUserSummary(process.updatedBy))
            .owningUnit(process.owningUnit?.let { OrganisationalUnitSummaryResponse(it.key, it.getName("en")) })
            .processOwner(UserMapper.toUserSummary(process.effectiveOwner()))
            .processSteward(UserMapper.toUserSummary(effectiveSteward))
            .stewardIsExplicit(process.processSteward != null)
            .technicalCustodian(UserMapper.toUserSummary(effectiveCustodian))
            .custodianIsExplicit(process.technicalCustodian != null)
            .code(process.code)
            .processType(toProcessType(process.processType))
            .boundedContext(BoundedContextMapper.toSummaryResponse(process.boundedContext))
            .inputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.inputEntities))
            .outputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.outputEntities))
            .effectiveInputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(effectiveInputEntities))
            .effectiveOutputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(effectiveOutputEntities))
            .executingUnits(toOrgUnitSummaryList(process.executingUnits))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(process.classificationAssignments))
            .parentProcess(toProcessSummaryResponse(process.parent))
            .childProcesses(process.children.map { toProcessSummaryResponse(it)!! })
            .legalBasis(toLegalBasis(process.legalBasis))
            .purpose(process.purpose?.let { LocalizedTextMapper.toModel(it) })
            .securityMeasures(process.securityMeasures?.let { LocalizedTextMapper.toModel(it) })
            .crossBorderTransfers(process.crossBorderTransfers.orEmpty().map { CrossBorderTransferMapper.toCrossBorderTransferEntry(it) })
            .serviceProviders(process.serviceProviders.map { serviceProviderMapper.toServiceProviderSummaryResponse(it) })
            .capabilities(process.capabilities.map { capabilityMapper.toCapabilitySummaryResponse(it) })
            .itSystems(process.itSystems.map { ItSystemSummaryResponse(it.key, it.getName("en"), it.processingCountries) })
            .derivedProcessingCountries(derivedProcessingCountries(process))
            .valueStreamType(toValueStreamType(process.valueStreamType))
            .cycleTimeMinutes(process.cycleTimeMinutes)
            .waitTimeMinutes(process.waitTimeMinutes)
            .changeoverTimeMinutes(process.changeoverTimeMinutes)
            .frequencyCount(process.frequencyCount)
            .frequencyPeriod(toFrequencyPeriod(process.frequencyPeriod))
            .activityType(toActivityType(process.activityType))
            .activityJustification(process.activityJustification?.let { LocalizedTextMapper.toModel(it) })
            .firstPassYield(process.firstPassYield)
            .completionRate(process.completionRate)
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
            .hiddenFields(fc.hidden)
            .fieldStatuses(fieldStatuses)
            .editableFields(
                currentUser?.let { u ->
                    val uid = u.id
                    val isOwner = uid != null && process.effectiveOwner()?.id == uid
                    val isSteward = uid != null && effectiveSteward?.id == uid
                    roleService.editableFields(u, "BUSINESS_PROCESS", isOwner, isSteward)
                },
            ).calledProcessKeys(
                processFlowNodeRepository
                    .findByProcessKeyOrderByPosition(process.key)
                    .mapNotNull { it.linkedProcessKey }
                    .distinct()
            )
    }

    fun toProcessSummaryResponse(process: Process?): ProcessSummaryResponse? {
        if (process == null) return null
        return ProcessSummaryResponse(process.key, process.getName("en"))
            .boundedContext(BoundedContextMapper.toSummaryResponse(process.boundedContext))
            .description(process.descriptions.firstOrNull()?.text)
    }

    fun toProcessVersionResponse(version: ProcessVersion): ProcessVersionResponse =
        ProcessVersionResponse(
            version.versionNumber,
            UserMapper.toUserSummary(version.changedBy),
            toChangeType(version.changeType),
            toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)

    fun toProcessTreeResponse(process: Process): ProcessTreeResponse =
        ProcessTreeResponse(
            process.key,
            LocalizedTextMapper.toModel(process.names),
            process.children.map { toProcessTreeResponse(it) }.sortedBy { it.key }
        ).processType(toProcessType(process.processType))

    fun toProcessTreeResponses(processes: Collection<Process>): List<ProcessTreeResponse> =
        processes
            .map {
                toProcessTreeResponse(it)
            }.sortedBy { it.key }

    companion object {
        @JvmStatic
        fun derivedProcessingCountries(process: Process): List<String> {
            val result = mutableSetOf<String>()
            val visited = mutableSetOf<String>()

            fun collect(p: Process) {
                if (!visited.add(p.key)) return
                p.itSystems.forEach { result.addAll(it.processingCountries) }
                p.serviceProviders
                    .filter { it.serviceProviderType == "DATA_PROCESSOR" }
                    .forEach { result.addAll(it.processingCountries) }
                p.children.forEach { collect(it) }
            }

            collect(process)
            return result.sorted()
        }

        /**
         * Single source of truth for "does this process (effectively, including sub-processes)
         * handle personal data?" — reads the typed [BusinessEntity.containsPersonalData] flag over
         * the effective input+output entity roll-up. Used by the process response, the dashboard
         * (needs-attention + DPIA coverage) and the processing register so they never disagree.
         */
        @JvmStatic
        fun effectivelyHandlesPersonalData(process: Process): Boolean {
            val entities =
                collectEffectiveEntities(process) { it.inputEntities } +
                    collectEffectiveEntities(process) { it.outputEntities }
            return entities.any { it.containsPersonalData == true }
        }

        @JvmStatic
        fun collectEffectiveEntities(
            process: Process,
            selector: (Process) -> Collection<BusinessEntity>
        ): List<BusinessEntity> {
            val seen = mutableSetOf<String>()
            val visitedProcesses = mutableSetOf<String>()
            val result = mutableListOf<BusinessEntity>()

            fun collect(p: Process) {
                if (!visitedProcesses.add(p.key)) return
                for (entity in selector(p)) {
                    if (seen.add(entity.key)) result.add(entity)
                }
                for (child in p.children) collect(child)
            }
            collect(process)
            return result
        }

        @JvmStatic
        fun toOrgUnitSummaryList(units: Collection<OrganisationalUnit>?): List<OrganisationalUnitSummaryResponse> {
            if (units == null) return emptyList()
            return units.map { unit -> OrganisationalUnitSummaryResponse(unit.key, unit.getName("en")) }
        }

        @JvmStatic
        fun toProcessType(processType: String?): ProcessType? {
            if (processType == null) return null
            return ProcessType.fromValue(processType)
        }

        @JvmStatic
        fun toChangeType(changeType: String?): ProcessVersionResponseChangeType? {
            if (changeType == null) return null
            return ProcessVersionResponseChangeType.fromValue(changeType)
        }

        @JvmStatic
        fun toLegalBasis(legalBasis: String?): LegalBasis? {
            if (legalBasis == null) return null
            return LegalBasis.fromValue(legalBasis)
        }

        @JvmStatic
        fun toValueStreamType(value: String?): org.leargon.backend.model.ValueStreamType? {
            if (value == null) return null
            return org.leargon.backend.model.ValueStreamType
                .fromValue(value)
        }

        @JvmStatic
        fun toFrequencyPeriod(value: String?): org.leargon.backend.model.FrequencyPeriod? {
            if (value == null) return null
            return org.leargon.backend.model.FrequencyPeriod
                .fromValue(value)
        }

        @JvmStatic
        fun toActivityType(value: String?): org.leargon.backend.model.ActivityType? {
            if (value == null) return null
            return org.leargon.backend.model.ActivityType
                .fromValue(value)
        }

        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)
    }
}
