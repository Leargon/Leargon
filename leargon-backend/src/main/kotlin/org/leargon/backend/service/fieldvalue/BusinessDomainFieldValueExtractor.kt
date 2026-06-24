package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDomain

@Singleton
class BusinessDomainFieldValueExtractor : FieldValueExtractor<BusinessDomain> {
    override val entityType = "BUSINESS_DOMAIN"

    override fun value(
        entity: BusinessDomain,
        fieldName: String
    ): String? =
        when {
            fieldName.startsWith("names.") -> FieldValueSupport.localized(entity.names, "names", fieldName)
            fieldName.startsWith("descriptions.") -> FieldValueSupport.localized(entity.descriptions, "descriptions", fieldName)
            fieldName.startsWith("classification.") -> FieldValueSupport.classification(entity.classificationAssignments, fieldName)
            fieldName == "type" -> FieldValueSupport.blankToNull(entity.type)
            fieldName == "parent" -> entity.parent?.key
            fieldName == "owningUnit" -> entity.owningUnit?.key
            fieldName == "visionStatement" -> FieldValueSupport.blankToNull(entity.visionStatement)
            // Collection / relationship fields — not status-tracked
            fieldName == "boundedContexts" -> null
            fieldName == "contextRelationships" -> null
            fieldName == "domainEvents" -> null
            else -> error("Unhandled BUSINESS_DOMAIN field for verification: $fieldName")
        }
}
