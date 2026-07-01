package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.repository.BusinessDataQualityRuleRepository
import org.leargon.backend.repository.TranslationLinkRepository

@Singleton
class BusinessEntityFieldValueExtractor(
    private val qualityRuleRepository: BusinessDataQualityRuleRepository,
    private val translationLinkRepository: TranslationLinkRepository
) : FieldValueExtractor<BusinessEntity> {
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

            fieldName.startsWith("retentionPeriod.") -> FieldValueSupport.localized(entity.retentionPeriod, "retentionPeriod", fieldName)

            fieldName == "storageLocations" -> FieldValueSupport.keysOf(entity.storageLocations)

            // Collection / relationship fields — tracked per-item via collectionItemValues(), not here
            fieldName == "qualityRules" -> null

            fieldName == "interfaceEntities" -> null

            fieldName == "implementationEntities" -> null

            fieldName == "relationships" -> null

            fieldName == "translationLinks" -> null

            else -> error("Unhandled BUSINESS_ENTITY field for verification: $fieldName")
        }

    override fun collectionItemValues(entity: BusinessEntity): Map<String, String> {
        val result = HashMap<String, String>()
        // Relationships — both directions, canonical row-based signature so both endpoints agree.
        (entity.relationshipsFirst + entity.relationshipsSecond).forEach { rel ->
            val id = rel.id ?: return@forEach
            result["relationship.$id"] =
                FieldValueSupport.signature(
                    rel.firstBusinessEntity?.key,
                    rel.secondBusinessEntity?.key,
                    rel.firstCardinalityMinimum,
                    rel.firstCardinalityMaximum,
                    rel.secondCardinalityMinimum,
                    rel.secondCardinalityMaximum,
                    FieldValueSupport.localizedSignature(rel.descriptions),
                )
        }
        result.putAll(FieldValueSupport.items("interface", entity.interfaceEntities, { it.key }, { it.key }))
        result.putAll(FieldValueSupport.items("implementation", entity.implementationEntities, { it.key }, { it.key }))
        // Quality rules — queried fresh (avoids stale lazy collection on live edits / backfill).
        qualityRuleRepository.findAllByBusinessEntityKey(entity.key).forEach { r ->
            val id = r.id ?: return@forEach
            result["qualityRule.$id"] = FieldValueSupport.signature(FieldValueSupport.localizedSignature(r.descriptions), r.severity)
        }
        // Translation links — not a collection on the entity; query by key (both directions).
        val translationLinks =
            translationLinkRepository.findByFirstEntityKey(entity.key) +
                translationLinkRepository.findBySecondEntityKey(entity.key)
        translationLinks.forEach { link ->
            val id = link.id ?: return@forEach
            result["translationLink.$id"] =
                FieldValueSupport.signature(
                    link.firstEntity?.key, link.secondEntity?.key,
                    FieldValueSupport
                        .localizedSignature(link.semanticDifferenceNote)
                )
        }
        return result
    }
}
