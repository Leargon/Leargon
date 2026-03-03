package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.ProcessVersion
import org.leargon.backend.model.OrganisationalUnitSummaryResponse
import org.leargon.backend.model.ProcessResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.model.ProcessTreeResponse
import org.leargon.backend.model.ProcessType
import org.leargon.backend.model.ProcessVersionResponse
import org.leargon.backend.model.ProcessVersionResponseChangeType
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class ProcessMapper {

    fun toProcessResponse(process: Process): ProcessResponse {
        return ProcessResponse(
            process.key,
            UserMapper.toUserSummary(process.processOwner),
            UserMapper.toUserSummary(process.createdBy),
            LocalizedTextMapper.toModel(process.names),
            LocalizedTextMapper.toModel(process.descriptions),
            toZonedDateTime(process.createdAt),
            toZonedDateTime(process.updatedAt)
        )
            .code(process.code)
            .processType(toProcessType(process.processType))
            .businessDomain(BusinessDomainMapper.toBusinessDomainSummary(process.businessDomain))
            .inputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.inputEntities))
            .outputEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(process.outputEntities))
            .executingUnits(toOrgUnitSummaryList(process.executingUnits))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(process.classificationAssignments))
            .parentProcess(toProcessSummaryResponse(process.parent))
            .childProcesses(process.children.map { toProcessSummaryResponse(it)!! })
    }

    fun toProcessSummaryResponse(process: Process?): ProcessSummaryResponse? {
        if (process == null) return null
        return ProcessSummaryResponse(process.key, process.getName("en"))
    }

    fun toProcessVersionResponse(version: ProcessVersion): ProcessVersionResponse {
        return ProcessVersionResponse(
            version.versionNumber,
            UserMapper.toUserSummary(version.changedBy),
            toChangeType(version.changeType),
            toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)
    }

    fun toProcessTreeResponse(process: Process): ProcessTreeResponse {
        return ProcessTreeResponse(
            process.key,
            LocalizedTextMapper.toModel(process.names),
            process.children.map { toProcessTreeResponse(it) }.sortedBy { it.key }
        ).processType(toProcessType(process.processType))
    }

    fun toProcessTreeResponses(processes: Collection<Process>): List<ProcessTreeResponse> {
        return processes.map { toProcessTreeResponse(it) }.sortedBy { it.key }
    }

    companion object {
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
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? {
            return instant?.atZone(ZoneOffset.UTC)
        }
    }
}
