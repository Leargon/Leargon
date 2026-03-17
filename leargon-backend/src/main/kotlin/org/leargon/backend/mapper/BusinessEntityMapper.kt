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
import org.leargon.backend.service.FieldConfigurationService
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class BusinessEntityMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val dataProcessorMapper: DataProcessorMapper
) {

    fun toBusinessEntityResponse(businessEntity: BusinessEntity): BusinessEntityResponse {
        val fc = fieldConfigurationService.compute("BUSINESS_ENTITY") { fieldName ->
            when {
                fieldName == "names" -> businessEntity.names.isNotEmpty()
                fieldName == "descriptions" -> businessEntity.descriptions.isNotEmpty()
                fieldName == "businessDomain" -> businessEntity.businessDomain != null
                fieldName == "retentionPeriod" -> !businessEntity.retentionPeriod.isNullOrBlank()
                fieldName.startsWith("names.") -> {
                    val locale = fieldName.removePrefix("names.")
                    businessEntity.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                }
                fieldName.startsWith("descriptions.") -> {
                    val locale = fieldName.removePrefix("descriptions.")
                    businessEntity.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                }
                fieldName.startsWith("classification.") -> {
                    val classKey = fieldName.removePrefix("classification.")
                    businessEntity.classificationAssignments.any { it.classificationKey == classKey }
                }
                else -> true
            }
        }
        return BusinessEntityResponse(
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
            .relationships(toBusinessEntityRelationships(businessEntity.getAllRelationships()))
            .children(toBusinessEntitySummaryResponseArray(businessEntity.children))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(businessEntity.classificationAssignments))
            .retentionPeriod(businessEntity.retentionPeriod)
            .crossBorderTransfers(businessEntity.crossBorderTransfers.orEmpty().map { DataProcessorMapper.toCrossBorderTransferEntry(it) })
            .dataProcessors(businessEntity.dataProcessors.orEmpty().map { dataProcessorMapper.toDataProcessorSummaryResponse(it) })
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
    }

    fun toLocalizedBusinessEntityResponse(entity: BusinessEntity, locale: String): LocalizedBusinessEntityResponse {
        return LocalizedBusinessEntityResponse(
            entity.key,
            entity.getName(locale),
            toZonedDateTime(entity.createdAt),
            toZonedDateTime(entity.updatedAt)
        )
            .description(if (entity.descriptions.isEmpty()) null else entity.getDescription(locale))
            .dataOwner(UserMapper.toUserSummary(entity.dataOwner))
            .parent(toBusinessEntitySummaryResponse(entity.parent))
            .businessDomain(BusinessDomainMapper.toBusinessDomainSummary(entity.businessDomain))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(entity.classificationAssignments))
    }

    fun toBusinessEntityRelationships(businessEntityRelationships: Set<BusinessEntityRelationship>?): List<BusinessEntityRelationshipResponse> {
        if (businessEntityRelationships == null) return emptyList()
        return businessEntityRelationships.map { rel ->
            BusinessEntityRelationshipResponse()
                .id(rel.id)
                .descriptions(LocalizedTextMapper.toModel(rel.descriptions))
                .addCardinalityItem(
                    BusinessEntityRelationshipResponseCardinalityInner(
                        toBusinessEntitySummaryResponse(rel.firstBusinessEntity),
                        rel.firstCardinalityMinimum
                    ).maximum(rel.firstCardinalityMaximum)
                )
                .addCardinalityItem(
                    BusinessEntityRelationshipResponseCardinalityInner(
                        toBusinessEntitySummaryResponse(rel.secondBusinessEntity),
                        rel.secondCardinalityMinimum
                    ).maximum(rel.secondCardinalityMaximum)
                )
        }
    }

    fun toBusinessEntityVersionResponse(version: BusinessEntityVersion): BusinessEntityVersionResponse {
        return BusinessEntityVersionResponse(
            version.versionNumber,
            UserMapper.toUserSummary(version.changedBy),
            toChangeType(version.changeType),
            toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)
    }

    fun toBusinessEntityTreeResponse(businessEntity: BusinessEntity): BusinessEntityTreeResponse {
        return BusinessEntityTreeResponse(
            businessEntity.key,
            LocalizedTextMapper.toModel(businessEntity.names),
            LocalizedTextMapper.toModel(businessEntity.descriptions),
            toBusinessEntityTreeResponses(businessEntity.children)
        ).parent(toBusinessEntitySummaryResponse(businessEntity.parent))
    }

    fun toBusinessEntityTreeResponses(businessEntities: Collection<BusinessEntity>?): List<BusinessEntityTreeResponse> {
        if (businessEntities == null) return emptyList()
        return businessEntities.map { toBusinessEntityTreeResponse(it) }
    }

    companion object {
        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? {
            return instant?.atZone(ZoneOffset.UTC)
        }

        @JvmStatic
        fun toChangeType(changeType: String?): BusinessEntityVersionResponseChangeType? {
            if (changeType == null) return null
            return BusinessEntityVersionResponseChangeType.fromValue(changeType)
        }

        @JvmStatic
        fun rootOf(entity: BusinessEntity): BusinessEntity = if (entity.parent == null) entity else rootOf(entity.parent!!)

        @JvmStatic
        fun toBusinessEntitySummaryResponse(entity: BusinessEntity?): BusinessEntitySummaryResponse? {
            if (entity == null) return null
            val root = if (entity.parent == null) null else rootOf(entity.parent!!)
            return BusinessEntitySummaryResponse(entity.key, entity.getName("en"))
                .parentKey(entity.parent?.key)
                .parentName(entity.parent?.getName("en"))
                .rootKey(root?.key)
                .rootName(root?.getName("en"))
        }

        @JvmStatic
        fun toBusinessEntitySummaryResponseArray(businessEntities: Collection<BusinessEntity>?): List<BusinessEntitySummaryResponse> {
            if (businessEntities == null) return emptyList()
            return businessEntities.map { toBusinessEntitySummaryResponse(it)!! }
        }
    }
}
