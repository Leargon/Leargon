package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.model.OrganisationalUnitResponse
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.OrganisationalUnitTreeResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.service.DefaultLocaleProvider
import org.leargon.backend.service.FieldConfigurationService
import org.leargon.backend.service.FieldVerificationService
import org.leargon.backend.service.MethodologyConfigurationService
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class OrganisationalUnitMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val serviceProviderMapper: ServiceProviderMapper,
    private val fieldVerificationService: FieldVerificationService,
    private val defaultLocaleProvider: DefaultLocaleProvider
) {
    /** The tenant default locale, used for the flat `name` fallback on every summary DTO. */
    private val defaultLocale: String get() = defaultLocaleProvider.code()

    fun toResponse(
        unit: OrganisationalUnit,
        executingProcesses: List<Process> = emptyList()
    ): OrganisationalUnitResponse {
        val disabledMethodologies = methodologyConfigurationService.getDisabledMethodologies()
        val fc = fieldConfigurationService.compute("ORGANISATIONAL_UNIT", disabledMethodologies, presenceOf(unit))
        val fvSvc = this.fieldVerificationService
        val fieldStatuses =
            if (methodologyConfigurationService.isVerificationEnabled("ORGANISATIONAL_UNIT")) {
                unit.id?.let { id -> FieldVerificationMapper.toResponses(fvSvc.getStatuses("ORGANISATIONAL_UNIT", id)) }
            } else {
                null
            }
        return OrganisationalUnitResponse(
            unit.key,
            UserMapper.toUserSummary(unit.createdBy),
            LocalizedTextMapper.toModel(unit.names),
            toZonedDateTime(unit.createdAt),
            toZonedDateTime(unit.updatedAt)
        ).unitType(unit.unitType)
            .teamTopologyType(toTeamTopologyType(unit.teamTopologyType))
            .businessOwner(if (unit.businessOwner != null) UserMapper.toUserSummary(unit.businessOwner) else null)
            .businessSteward(if (unit.businessSteward != null) UserMapper.toUserSummary(unit.businessSteward) else null)
            .technicalCustodian(if (unit.technicalCustodian != null) UserMapper.toUserSummary(unit.technicalCustodian) else null)
            .descriptions(LocalizedTextMapper.toModel(unit.descriptions))
            .missionStatement(LocalizedTextMapper.toModel(unit.missionStatement))
            .parents(toSummaryList(unit.parents))
            .children(toSummaryList(unit.children))
            .executingProcesses(toProcessSummaryList(executingProcesses, defaultLocale))
            .isExternal(unit.isExternal)
            .externalCompanyName(unit.externalCompanyName)
            .countryOfExecution(unit.countryOfExecution)
            .serviceProviders(unit.serviceProviders.map { serviceProviderMapper.toServiceProviderSummaryResponse(it) })
            .dataAccessEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(unit.dataAccessEntities, defaultLocale))
            .dataManipulationEntities(
                BusinessEntityMapper
                    .toBusinessEntitySummaryResponseArray(unit.dataManipulationEntities, defaultLocale)
            ).classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(unit.classificationAssignments))
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
            .hiddenFields(fc.hidden)
            .fieldStatuses(fieldStatuses)
    }

    fun toTreeResponse(unit: OrganisationalUnit): OrganisationalUnitTreeResponse =
        OrganisationalUnitTreeResponse(
            unit.key,
            LocalizedTextMapper.toModel(unit.names),
            unit.children.map { toTreeResponse(it) }.sortedBy { it.key }
        ).unitType(unit.unitType)

    fun toTreeResponses(units: Collection<OrganisationalUnit>): List<OrganisationalUnitTreeResponse> =
        units
            .map {
                toTreeResponse(it)
            }.sortedBy { it.key }

    fun toSummaryResponse(unit: OrganisationalUnit?): OrganisationalUnitSummaryResponse? = SummaryMappers.orgUnit(unit, defaultLocale)

    fun toSummaryList(units: Collection<OrganisationalUnit>?): List<OrganisationalUnitSummaryResponse> =
        SummaryMappers.orgUnits(units, defaultLocale)

    companion object {
        @JvmStatic
        fun toProcessSummaryList(
            processes: List<Process>?,
            defaultLocale: String
        ): List<ProcessSummaryResponse> = SummaryMappers.processes(processes, defaultLocale)

        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)

        @JvmStatic
        fun toTeamTopologyType(value: String?): org.leargon.backend.model.TeamTopologyType? {
            if (value == null) return null
            return org.leargon.backend.model.TeamTopologyType
                .fromValue(value)
        }
    }

    /**
     * Whether each configurable field of [unit] currently has a value. Shared by the response mapper
     * (for `missingMandatoryFields`) and `TaskService` (for MISSING_MANDATORY_FIELD to-dos), so the two
     * can never disagree about what counts as filled in.
     */
    fun presenceOf(unit: OrganisationalUnit): (String) -> Boolean =
        { fieldName ->
            when {
                fieldName == "names" -> {
                    unit.names.isNotEmpty()
                }

                fieldName == "descriptions" -> {
                    unit.descriptions.isNotEmpty()
                }

                fieldName == "unitType" -> {
                    !unit.unitType.isNullOrBlank()
                }

                fieldName == "teamTopologyType" -> {
                    !unit.teamTopologyType.isNullOrBlank()
                }

                fieldName == "businessOwner" -> {
                    unit.businessOwner != null
                }

                fieldName.startsWith("names.") -> {
                    val locale = fieldName.removePrefix("names.")
                    unit.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                }

                fieldName.startsWith("descriptions.") -> {
                    val locale = fieldName.removePrefix("descriptions.")
                    unit.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                }

                fieldName.startsWith("missionStatement.") -> {
                    val locale = fieldName.removePrefix("missionStatement.")
                    unit.missionStatement.any { it.locale == locale && !it.text.isNullOrBlank() }
                }

                fieldName.startsWith("classification.") -> {
                    val classKey = fieldName.removePrefix("classification.")
                    unit.classificationAssignments.any { it.classificationKey == classKey }
                }

                else -> {
                    true
                }
            }
        }
}
