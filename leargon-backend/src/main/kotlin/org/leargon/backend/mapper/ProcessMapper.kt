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
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class ProcessMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val serviceProviderMapper: ServiceProviderMapper,
    private val capabilityMapper: CapabilityMapper,
    private val processFlowNodeRepository: ProcessFlowNodeRepository
) {
    fun toProcessResponse(process: Process): ProcessResponse {
        val fc =
            fieldConfigurationService.compute("BUSINESS_PROCESS") { fieldName ->
                when {
                    fieldName == "names" -> process.names.isNotEmpty()
                    fieldName == "descriptions" -> process.descriptions.isNotEmpty()
                    fieldName == "boundedContext" -> process.boundedContext != null
                    fieldName == "processOwner" -> (process.processOwner ?: process.boundedContext?.owningUnit?.businessOwner) != null
                    fieldName == "executingUnits" -> process.executingUnits.isNotEmpty()
                    fieldName == "legalBasis" -> process.legalBasis != null
                    fieldName.startsWith("names.") -> {
                        val locale = fieldName.removePrefix("names.")
                        process.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }
                    fieldName.startsWith("descriptions.") -> {
                        val locale = fieldName.removePrefix("descriptions.")
                        process.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }
                    fieldName.startsWith("classification.") -> {
                        val classKey = fieldName.removePrefix("classification.")
                        process.classificationAssignments.any { it.classificationKey == classKey }
                    }
                    else -> true
                }
            }
        val owningUnit = process.boundedContext?.owningUnit
        val effectiveOwner = process.processOwner ?: owningUnit?.businessOwner
        val effectiveSteward = process.processSteward ?: owningUnit?.businessSteward
        val effectiveCustodian = process.technicalCustodian ?: owningUnit?.technicalCustodian
        val effectiveInputEntities = collectEffectiveEntities(process) { it.inputEntities }
        val effectiveOutputEntities = collectEffectiveEntities(process) { it.outputEntities }
        val allEffectiveEntities = (effectiveInputEntities + effectiveOutputEntities).distinctBy { it.key }
        val containsPersonalData =
            allEffectiveEntities.any { entity ->
                entity.classificationAssignments.any {
                    it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                }
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
        ).processOwner(UserMapper.toUserSummary(effectiveOwner))
            .processSteward(UserMapper.toUserSummary(effectiveSteward))
            .technicalCustodian(UserMapper.toUserSummary(effectiveCustodian))
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
            .purpose(LocalizedTextMapper.toModel(process.purpose))
            .securityMeasures(LocalizedTextMapper.toModel(process.securityMeasures))
            .crossBorderTransfers(process.crossBorderTransfers.orEmpty().map { CrossBorderTransferMapper.toCrossBorderTransferEntry(it) })
            .serviceProviders(process.serviceProviders.map { serviceProviderMapper.toServiceProviderSummaryResponse(it) })
            .capabilities(process.capabilities.map { capabilityMapper.toCapabilitySummaryResponse(it) })
            .itSystems(process.itSystems.map { ItSystemSummaryResponse(it.key, it.getName("en")) })
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
            .calledProcessKeys(
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
        fun collectEffectiveEntities(
            process: Process,
            selector: (Process) -> Collection<BusinessEntity>
        ): List<BusinessEntity> {
            val seen = mutableSetOf<String>()
            val result = mutableListOf<BusinessEntity>()

            fun collect(p: Process) {
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
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)
    }
}
