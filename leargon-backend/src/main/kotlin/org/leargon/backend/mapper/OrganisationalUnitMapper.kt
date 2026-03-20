package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.service.FieldConfigurationService
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime



@Singleton
open class OrganisationalUnitMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val dataProcessorMapper: DataProcessorMapper
) {

    fun toResponse(unit: OrganisationalUnit, executingProcesses: List<Process> = emptyList()): OrganisationalUnitResponse {
        val fc = fieldConfigurationService.compute("ORGANISATIONAL_UNIT") { fieldName ->
            when {
                fieldName == "names" -> unit.names.isNotEmpty()
                fieldName == "descriptions" -> unit.descriptions.isNotEmpty()
                fieldName == "unitType" -> !unit.unitType.isNullOrBlank()
                fieldName == "lead" -> unit.lead != null
                fieldName.startsWith("names.") -> {
                    val locale = fieldName.removePrefix("names.")
                    unit.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                }
                fieldName.startsWith("descriptions.") -> {
                    val locale = fieldName.removePrefix("descriptions.")
                    unit.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                }
                fieldName.startsWith("classification.") -> {
                    val classKey = fieldName.removePrefix("classification.")
                    unit.classificationAssignments.any { it.classificationKey == classKey }
                }
                else -> true
            }
        }
        return OrganisationalUnitResponse(
            unit.key,
            UserMapper.toUserSummary(unit.createdBy),
            LocalizedTextMapper.toModel(unit.names),
            toZonedDateTime(unit.createdAt),
            toZonedDateTime(unit.updatedAt)
        )
            .unitType(unit.unitType)
            .lead(if (unit.lead != null) UserMapper.toUserSummary(unit.lead) else null)
            .descriptions(LocalizedTextMapper.toModel(unit.descriptions))
            .parents(toSummaryList(unit.parents))
            .children(toSummaryList(unit.children))
            .executingProcesses(toProcessSummaryList(executingProcesses))
            .isExternal(unit.isExternal)
            .externalCompanyName(unit.externalCompanyName)
            .countryOfExecution(unit.countryOfExecution)
            .linkedDataProcessor(unit.linkedDataProcessor?.let { dataProcessorMapper.toDataProcessorSummaryResponse(it) })
            .dataAccessEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(unit.dataAccessEntities))
            .dataManipulationEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(unit.dataManipulationEntities))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(unit.classificationAssignments))
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
    }

    fun toTreeResponse(unit: OrganisationalUnit): OrganisationalUnitTreeResponse {
        return OrganisationalUnitTreeResponse(
            unit.key,
            LocalizedTextMapper.toModel(unit.names),
            unit.children.map { toTreeResponse(it) }.sortedBy { it.key }
        ).unitType(unit.unitType)
    }

    fun toTreeResponses(units: Collection<OrganisationalUnit>): List<OrganisationalUnitTreeResponse> {
        return units.map { toTreeResponse(it) }.sortedBy { it.key }
    }

    fun toSummaryResponse(unit: OrganisationalUnit?): OrganisationalUnitSummaryResponse? {
        if (unit == null) return null
        return OrganisationalUnitSummaryResponse(unit.key, unit.getName("en"))
    }

    fun toSummaryList(units: Collection<OrganisationalUnit>?): List<OrganisationalUnitSummaryResponse> {
        if (units == null) return emptyList()
        return units.map { toSummaryResponse(it)!! }
    }

    companion object {
        @JvmStatic
        fun toProcessSummaryList(processes: List<Process>?): List<ProcessSummaryResponse> {
            if (processes == null) return emptyList()
            return processes.map { proc -> ProcessSummaryResponse(proc.key, proc.getName("en")) }
        }

        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? {
            return instant?.atZone(ZoneOffset.UTC)
        }
    }
}
