package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity

@Singleton
class BusinessEntityFieldValueExtractor : FieldValueExtractor<BusinessEntity> {
    override val entityType = "BUSINESS_ENTITY"

    override fun value(
        entity: BusinessEntity,
        fieldName: String
    ): String? =
        when {
            fieldName.startsWith("names.") -> FieldValueSupport.localized(entity.names, "names", fieldName)
            fieldName.startsWith("descriptions.") -> FieldValueSupport.localized(entity.descriptions, "descriptions", fieldName)
            fieldName.startsWith("classification.") -> FieldValueSupport.classification(entity.classificationAssignments, fieldName)
            fieldName == "dataOwner" -> entity.dataOwner?.username
            fieldName == "owningUnit" -> entity.owningUnit?.key
            fieldName == "dataSteward" -> entity.dataSteward?.username
            fieldName == "technicalCustodian" -> entity.technicalCustodian?.username
            fieldName == "parent" -> entity.parent?.key
            fieldName == "boundedContext" -> entity.boundedContext?.key
            fieldName == "retentionPeriod" -> FieldValueSupport.blankToNull(entity.retentionPeriod)
            fieldName == "storageLocations" -> FieldValueSupport.keysOf(entity.storageLocations)
            // Collection / relationship fields — not status-tracked
            fieldName == "qualityRules" -> null
            fieldName == "interfaceEntities" -> null
            fieldName == "implementationEntities" -> null
            fieldName == "relationships" -> null
            fieldName == "translationLinks" -> null
            else -> error("Unhandled BUSINESS_ENTITY field for verification: $fieldName")
        }
}
