package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.BusinessEntityRelationship
import org.leargon.backend.domain.BusinessEntityVersion
import org.leargon.backend.model.BusinessEntityRelationshipResponse
import org.leargon.backend.model.BusinessEntityRelationshipResponseCardinalityInner
import org.leargon.backend.model.BusinessEntityResponse
import org.leargon.backend.model.BusinessEntitySummaryResponse
import org.leargon.backend.model.BusinessEntityTreeResponse
import org.leargon.backend.model.BusinessEntityVersionResponse
import org.leargon.backend.model.BusinessEntityVersionResponseChangeType
import org.leargon.backend.model.LocalizedBusinessEntityResponse

import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
class BusinessEntityMapper {

    BusinessEntityResponse toBusinessEntityResponse(BusinessEntity businessEntity) {
        return new BusinessEntityResponse(
                businessEntity.key,
                UserMapper.toUserSummary(businessEntity.dataOwner),
                UserMapper.toUserSummary(businessEntity.createdBy),
                LocalizedTextMapper.toModel(businessEntity.names),
                LocalizedTextMapper.toModel(businessEntity.descriptions),
                toZonedDateTime(businessEntity.createdAt),
                toZonedDateTime(businessEntity.updatedAt)
        )
                .parent(toBusinessEntitySummaryResponse(businessEntity.parent))
                .businessDomain(BusinessDomainMapper.toBusinessDomainSummary(businessEntity.businessDomain))
                .interfacesEntities(toBusinessEntitySummaryResponseArray(businessEntity.interfaceEntities))
                .implementsEntities(toBusinessEntitySummaryResponseArray(businessEntity.implementationEntities))
                .relationships(toBusinessEntityRelationships(businessEntity.allRelationships))
                .children(toBusinessEntitySummaryResponseArray(businessEntity.children))
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(businessEntity.classificationAssignments))
    }

    LocalizedBusinessEntityResponse toLocalizedBusinessEntityResponse(BusinessEntity entity, String locale) {
        return new LocalizedBusinessEntityResponse(
                entity.key,
                entity.getName(locale),
                toZonedDateTime(entity.createdAt),
                toZonedDateTime(entity.updatedAt)
        )
                .description(entity.descriptions?.isEmpty() ? null : entity.getDescription(locale))
                .dataOwner(UserMapper.toUserSummary(entity.dataOwner))
                .parent(toBusinessEntitySummaryResponse(entity.parent))
                .businessDomain(BusinessDomainMapper.toBusinessDomainSummary(entity.businessDomain))
                .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(entity.classificationAssignments))
    }

    static List<BusinessEntitySummaryResponse> toBusinessEntitySummaryResponseArray(Set<BusinessEntity> businessEntities) {
        if (businessEntities == null) {
            return List.of()
        }
        return businessEntities.collect { toBusinessEntitySummaryResponse(it) }
    }

    List<BusinessEntityRelationshipResponse> toBusinessEntityRelationships(Set<BusinessEntityRelationship> businessEntityRelationships) {
        if (businessEntityRelationships == null) {
            return List.of()
        }

        List<BusinessEntityRelationshipResponse> relationships = new ArrayList<>()
        businessEntityRelationships.each { rel ->
            relationships.add(new BusinessEntityRelationshipResponse()
                    .id(rel.id)
                    .descriptions(LocalizedTextMapper.toModel(rel.descriptions))
                    .addCardinalityItem(
                            new BusinessEntityRelationshipResponseCardinalityInner(
                                    toBusinessEntitySummaryResponse(rel.firstBusinessEntity),
                                    rel.firstCardinalityMinimum
                            ).maximum(rel.firstCardinalityMaximum))
                    .addCardinalityItem(
                            new BusinessEntityRelationshipResponseCardinalityInner(
                                    toBusinessEntitySummaryResponse(rel.secondBusinessEntity),
                                    rel.secondCardinalityMinimum
                            ).maximum(rel.secondCardinalityMaximum)))
        }
        return relationships
    }

    BusinessEntityVersionResponse toBusinessEntityVersionResponse(BusinessEntityVersion version) {
        return new BusinessEntityVersionResponse(
                version.versionNumber,
                UserMapper.toUserSummary(version.changedBy),
                toChangeType(version.changeType),
                toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)
    }

    BusinessEntityTreeResponse toBusinessEntityTreeResponse(BusinessEntity businessEntity) {
        return new BusinessEntityTreeResponse(
                businessEntity.key,
                LocalizedTextMapper.toModel(businessEntity.names),
                LocalizedTextMapper.toModel(businessEntity.descriptions),
                toBusinessEntityTreeResponses(businessEntity.children)
        ).parent(toBusinessEntitySummaryResponse(businessEntity.parent))
    }

    List<BusinessEntityTreeResponse> toBusinessEntityTreeResponses(Collection<BusinessEntity> businessEntities) {
        if (businessEntities == null) {
            return new ArrayList<>()
        }
        return businessEntities.collect { toBusinessEntityTreeResponse(it) }
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }

    static BusinessEntityVersionResponseChangeType toChangeType(String changeType) {
        if (changeType == null) {
            return null
        }
        return BusinessEntityVersionResponseChangeType.fromValue(changeType)
    }

    static BusinessEntitySummaryResponse toBusinessEntitySummaryResponse(BusinessEntity entity) {
        if (entity == null) {
            return null
        }
        String name = entity.getName("en")
        return new BusinessEntitySummaryResponse(entity.key, name)
    }
}
