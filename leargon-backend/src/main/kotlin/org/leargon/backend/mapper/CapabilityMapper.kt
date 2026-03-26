package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Capability
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.CapabilitySummaryResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse
import java.time.ZoneOffset

@Singleton
class CapabilityMapper {
    fun toCapabilityResponse(capability: Capability): CapabilityResponse =
        CapabilityResponse(
            capability.key,
            LocalizedTextMapper.toModel(capability.names)
        ).descriptions(LocalizedTextMapper.toModel(capability.descriptions))
            .parent(capability.parent?.let { toCapabilitySummaryResponse(it) })
            .children(capability.children.map { toCapabilitySummaryResponse(it) })
            .owningUnit(capability.owningUnit?.let { toOrgUnitSummary(it) })
            .linkedProcesses(
                capability.linkedProcesses.map { ProcessSummaryResponse(it.key, it.getName("en")) }
            ).classificationAssignments(
                ClassificationMapper.toClassificationAssignmentResponses(capability.classificationAssignments)
            ).createdAt(capability.createdAt.atZone(ZoneOffset.UTC))
            .updatedAt(capability.updatedAt?.atZone(ZoneOffset.UTC))

    fun toCapabilitySummaryResponse(capability: Capability): CapabilitySummaryResponse =
        CapabilitySummaryResponse(capability.key, capability.getName("en"))
            .owningUnit(capability.owningUnit?.let { toOrgUnitSummary(it) })

    private fun toOrgUnitSummary(unit: OrganisationalUnit): OrganisationalUnitSummaryResponse =
        OrganisationalUnitSummaryResponse(unit.key, unit.getName("en"))
}
