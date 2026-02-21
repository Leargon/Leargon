package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.ProcessVersion
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
class ProcessMapper {

    ProcessResponse toProcessResponse(Process process) {
        return new ProcessResponse(
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
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(process.classificationAssignments))
                .parentProcess(toProcessSummaryResponse(process.parent))
                .childProcesses(process.children?.collect { toProcessSummaryResponse(it) } ?: [])
    }

    ProcessSummaryResponse toProcessSummaryResponse(Process process) {
        if (process == null) {
            return null
        }
        String name = process.getName("en")
        return new ProcessSummaryResponse(process.key, name)
    }

    ProcessVersionResponse toProcessVersionResponse(ProcessVersion version) {
        return new ProcessVersionResponse(
                version.versionNumber,
                UserMapper.toUserSummary(version.changedBy),
                toChangeType(version.changeType),
                toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)
    }

    ProcessTreeResponse toProcessTreeResponse(Process process) {
        return new ProcessTreeResponse(
                process.key,
                LocalizedTextMapper.toModel(process.names),
                process.children?.collect { toProcessTreeResponse(it) }?.sort { it.key } ?: []
        ).processType(toProcessType(process.processType))
    }

    List<ProcessTreeResponse> toProcessTreeResponses(Collection<Process> processes) {
        return processes.collect { toProcessTreeResponse(it) }.sort { it.key }
    }

    static ProcessType toProcessType(String processType) {
        if (processType == null) {
            return null
        }
        return ProcessType.fromValue(processType)
    }

    static ProcessVersionResponseChangeType toChangeType(String changeType) {
        if (changeType == null) {
            return null
        }
        return ProcessVersionResponseChangeType.fromValue(changeType)
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }
}
