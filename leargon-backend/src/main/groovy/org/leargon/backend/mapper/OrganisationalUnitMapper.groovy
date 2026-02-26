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
class OrganisationalUnitMapper {

    OrganisationalUnitResponse toResponse(OrganisationalUnit unit, List<Process> executingProcesses = []) {
        return new OrganisationalUnitResponse(
                unit.key,
                UserMapper.toUserSummary(unit.createdBy),
                LocalizedTextMapper.toModel(unit.names),
                toZonedDateTime(unit.createdAt),
                toZonedDateTime(unit.updatedAt)
        )
                .unitType(unit.unitType)
                .lead(unit.lead != null ? UserMapper.toUserSummary(unit.lead) : null)
                .descriptions(LocalizedTextMapper.toModel(unit.descriptions))
                .parents(toSummaryList(unit.parents))
                .children(toSummaryList(unit.children))
                .executingProcesses(toProcessSummaryList(executingProcesses))
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(unit.classificationAssignments))
    }

    static List<ProcessSummaryResponse> toProcessSummaryList(List<Process> processes) {
        if (processes == null) {
            return []
        }
        return processes.collect { proc ->
            new ProcessSummaryResponse(proc.key, proc.getName("en"))
        }
    }

    OrganisationalUnitTreeResponse toTreeResponse(OrganisationalUnit unit) {
        return new OrganisationalUnitTreeResponse(
                unit.key,
                LocalizedTextMapper.toModel(unit.names),
                unit.children?.collect { toTreeResponse(it) }?.sort { it.key } ?: []
        ).unitType(unit.unitType)
    }

    List<OrganisationalUnitTreeResponse> toTreeResponses(Collection<OrganisationalUnit> units) {
        return units.collect { toTreeResponse(it) }.sort { it.key }
    }

    OrganisationalUnitSummaryResponse toSummaryResponse(OrganisationalUnit unit) {
        if (unit == null) {
            return null
        }
        String name = unit.getName("en")
        return new OrganisationalUnitSummaryResponse(unit.key, name)
    }

    List<OrganisationalUnitSummaryResponse> toSummaryList(Collection<OrganisationalUnit> units) {
        if (units == null) {
            return []
        }
        return units.collect { toSummaryResponse(it) }
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }
}
