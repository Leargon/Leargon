package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Capability
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.model.CapabilityResponse
import org.leargon.backend.model.CapabilitySummaryResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.service.DefaultLocaleProvider
import java.time.ZoneOffset

@Singleton
open class CapabilityMapper(
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toCapabilityResponse(capability: Capability): CapabilityResponse =
        CapabilityResponse(
            capability.key,
            LocalizedTextMapper.toModel(capability.names)
        ).descriptions(LocalizedTextMapper.toModel(capability.descriptions))
            .parent(capability.parent?.let { toCapabilitySummaryResponse(it) })
            .children(capability.children.map { toCapabilitySummaryResponse(it) })
            .owningUnit(capability.owningUnit?.let { toOrgUnitSummary(it) })
            .linkedProcesses(
                SummaryMappers.processes(capability.linkedProcesses, defaultLocale)
            ).classificationAssignments(
                ClassificationMapper.toClassificationAssignmentResponses(capability.classificationAssignments)
            ).createdAt(capability.createdAt.atZone(ZoneOffset.UTC))
            .updatedAt(capability.updatedAt?.atZone(ZoneOffset.UTC))

    fun toCapabilitySummaryResponse(capability: Capability): CapabilitySummaryResponse =
        SummaryMappers
            .capability(capability, defaultLocale)!!
            .owningUnit(capability.owningUnit?.let { toOrgUnitSummary(it) })

    private fun toOrgUnitSummary(unit: OrganisationalUnit): OrganisationalUnitSummaryResponse =
        SummaryMappers.orgUnit(unit, defaultLocale)!!
}
