package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessDomainVersion
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainSummaryResponse
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.BusinessDomainType
import org.leargon.backend.model.BusinessDomainVersionResponse
import org.leargon.backend.model.BusinessDomainVersionResponseChangeType
import org.leargon.backend.model.LocalizedBusinessDomainResponse

import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
class BusinessDomainMapper {

    BusinessDomainResponse toBusinessDomainResponse(BusinessDomain domain) {
        return new BusinessDomainResponse(
                domain.key,
                UserMapper.toUserSummary(domain.createdBy),
                LocalizedTextMapper.toModel(domain.names),
                toZonedDateTime(domain.createdAt),
                toZonedDateTime(domain.updatedAt)
        )
                .parent(toBusinessDomainSummaryResponse(domain.parent))
                .descriptions(LocalizedTextMapper.toModel(domain.descriptions))
                .type(toBusinessDomainType(domain.type))
                .effectiveType(toBusinessDomainType(domain.effectiveType))
                .subdomains(toBusinessDomainSummaryResponseArray(domain.children))
                .assignedEntities(BusinessEntityMapper.toBusinessEntitySummaryResponseArray(domain.assignedEntities))
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(domain.classificationAssignments))
    }

    LocalizedBusinessDomainResponse toLocalizedBusinessDomainResponse(BusinessDomain domain, String locale) {
        return new LocalizedBusinessDomainResponse(
                domain.key,
                domain.getName(locale),
                toZonedDateTime(domain.createdAt),
                toZonedDateTime(domain.updatedAt)
        )
                .description(domain.descriptions?.isEmpty() ? null : domain.getDescription(locale))
                .parent(toBusinessDomainSummaryResponse(domain.parent))
                .type(toBusinessDomainType(domain.type))
                .effectiveType(toBusinessDomainType(domain.effectiveType))
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(domain.classificationAssignments))
    }

    BusinessDomainTreeResponse toBusinessDomainTreeResponse(BusinessDomain domain) {
        return new BusinessDomainTreeResponse(
                domain.key,
                LocalizedTextMapper.toModel(domain.names),
                toBusinessDomainTreeResponses(domain.children)
        )
                .parent(toBusinessDomainSummaryResponse(domain.parent))
                .descriptions(LocalizedTextMapper.toModel(domain.descriptions))
                .type(toBusinessDomainType(domain.type))
                .effectiveType(toBusinessDomainType(domain.effectiveType))
    }

    BusinessDomainVersionResponse toBusinessDomainVersionResponse(BusinessDomainVersion version) {
        return new BusinessDomainVersionResponse(
                version.versionNumber,
                UserMapper.toUserSummary(version.changedBy),
                toDomainChangeType(version.changeType),
                toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)
    }

    BusinessDomainSummaryResponse toBusinessDomainSummaryResponse(BusinessDomain domain) {
        if (domain == null) {
            return null
        }
        String name = domain.getName("en")
        return new BusinessDomainSummaryResponse(domain.key, name)
    }

    List<BusinessDomainTreeResponse> toBusinessDomainTreeResponses(Collection<BusinessDomain> businessDomains) {
        if (businessDomains == null) {
            return new ArrayList<>()
        }
        return businessDomains.collect { toBusinessDomainTreeResponse(it) }
    }

    List<BusinessDomainSummaryResponse> toBusinessDomainSummaryResponseArray(Set<BusinessDomain> businessDomains) {
        if (businessDomains == null) {
            return List.of()
        }
        return businessDomains.collect { toBusinessDomainSummaryResponse(it) }
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }

    static BusinessDomainType toBusinessDomainType(String businessDomainType) {
        if (businessDomainType == null) {
            return null
        }
        return BusinessDomainType.fromValue(businessDomainType)
    }

    static BusinessDomainVersionResponseChangeType toDomainChangeType(String changeType) {
        if (changeType == null) {
            return null
        }
        return BusinessDomainVersionResponseChangeType.fromValue(changeType)
    }

    static BusinessDomainSummaryResponse toBusinessDomainSummary(BusinessDomain domain) {
        if (domain == null) {
            return null
        }
        String name = domain.getName("en")
        return new BusinessDomainSummaryResponse(domain.key, name)
    }
}
