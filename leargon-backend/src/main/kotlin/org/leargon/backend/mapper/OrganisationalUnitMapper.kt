package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.ProcessSummaryResponse
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class OrganisationalUnitMapper {

    fun toResponse(unit: OrganisationalUnit, executingProcesses: List<Process> = emptyList()): OrganisationalUnitResponse {
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
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(unit.classificationAssignments))
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
