package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.Process

@Singleton
class ProcessFieldValueExtractor : FieldValueExtractor<Process> {
    override val entityType = "BUSINESS_PROCESS"

    override fun value(
        entity: Process,
        fieldName: String
    ): String? =
        when {
            fieldName.startsWith("names.") -> FieldValueSupport.localized(entity.names, "names", fieldName)

            fieldName.startsWith("descriptions.") -> FieldValueSupport.localized(entity.descriptions, "descriptions", fieldName)

            fieldName.startsWith("purpose.") -> FieldValueSupport.localized(entity.purpose, "purpose", fieldName)

            fieldName.startsWith("securityMeasures.") -> FieldValueSupport.localized(entity.securityMeasures, "securityMeasures", fieldName)

            fieldName.startsWith("classification.") -> FieldValueSupport.classification(entity.classificationAssignments, fieldName)

            fieldName == "processType" -> FieldValueSupport.blankToNull(entity.processType)

            fieldName == "code" -> FieldValueSupport.blankToNull(entity.code)

            fieldName == "processOwner" -> entity.processOwner?.username

            fieldName == "owningUnit" -> entity.owningUnit?.key

            fieldName == "processSteward" -> entity.processSteward?.username

            fieldName == "technicalCustodian" -> entity.technicalCustodian?.username

            fieldName == "parent" -> entity.parent?.key

            fieldName == "legalBasis" -> FieldValueSupport.blankToNull(entity.legalBasis)

            fieldName == "boundedContext" -> entity.boundedContext?.key

            // Collection / relationship fields — tracked per-item via collectionItemValues(), not here
            fieldName == "inputEntities" -> null

            fieldName == "outputEntities" -> null

            fieldName == "executingUnits" -> null

            fieldName == "crossBorderTransfers" -> null

            fieldName == "capabilities" -> null

            fieldName == "itSystems" -> null

            fieldName == "serviceProviders" -> null

            fieldName == "processDiagram" -> null

            fieldName == "calledProcesses" -> null

            else -> error("Unhandled BUSINESS_PROCESS field for verification: $fieldName")
        }

    override fun collectionItemValues(entity: Process): Map<String, String> {
        val result = HashMap<String, String>()
        result.putAll(FieldValueSupport.items("inputEntity", entity.inputEntities, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("outputEntity", entity.outputEntities, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("executingUnit", entity.executingUnits, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("capability", entity.capabilities, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("itSystem", entity.itSystems, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("serviceProvider", entity.serviceProviders, { it.key }, { it.key }))
        entity.crossBorderTransfers?.forEach { t ->
            val country = t.destinationCountry.takeUnless { it.isBlank() } ?: return@forEach
            // Base row = non-localized attributes; notes per-locale.
            result["crossBorderTransfer.$country"] = FieldValueSupport.signature(country, t.safeguard)
            result.putAll(FieldValueSupport.localizedItems("crossBorderTransfer.$country.notes", t.notes))
        }
        return result
    }
}
