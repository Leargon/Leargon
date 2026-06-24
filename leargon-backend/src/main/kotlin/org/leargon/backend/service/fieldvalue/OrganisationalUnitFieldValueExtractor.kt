package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.OrganisationalUnit

@Singleton
class OrganisationalUnitFieldValueExtractor : FieldValueExtractor<OrganisationalUnit> {
    override val entityType = "ORGANISATIONAL_UNIT"

    override fun value(
        entity: OrganisationalUnit,
        fieldName: String
    ): String? =
        when {
            fieldName.startsWith("names.") -> FieldValueSupport.localized(entity.names, "names", fieldName)
            fieldName.startsWith("descriptions.") -> FieldValueSupport.localized(entity.descriptions, "descriptions", fieldName)
            fieldName.startsWith("classification.") -> FieldValueSupport.classification(entity.classificationAssignments, fieldName)
            fieldName == "unitType" -> FieldValueSupport.blankToNull(entity.unitType)
            fieldName == "businessOwner" -> entity.businessOwner?.username
            fieldName == "businessSteward" -> entity.businessSteward?.username
            fieldName == "technicalCustodian" -> entity.technicalCustodian?.username
            fieldName == "isExternal" -> entity.isExternal.toString()
            fieldName == "externalCompanyName" -> FieldValueSupport.blankToNull(entity.externalCompanyName)
            fieldName == "countryOfExecution" -> FieldValueSupport.blankToNull(entity.countryOfExecution)
            // Collection / relationship fields — not status-tracked
            fieldName == "parents" -> null
            fieldName == "executingProcesses" -> null
            fieldName == "dataAccessEntities" -> null
            fieldName == "dataManipulationEntities" -> null
            fieldName == "serviceProviders" -> null
            fieldName == "boundedContexts" -> null
            else -> error("Unhandled ORGANISATIONAL_UNIT field for verification: $fieldName")
        }
}
