package org.leargon.backend.service.fieldvalue

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.ContextRelationship
import org.leargon.backend.repository.ContextRelationshipRepository

@Singleton
class BusinessDomainFieldValueExtractor(
    private val contextRelationshipRepository: ContextRelationshipRepository
) : FieldValueExtractor<BusinessDomain> {
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

            // Collection / relationship fields — tracked per-item via collectionItemValues(), not here
            fieldName == "boundedContexts" -> null

            fieldName == "contextRelationships" -> null

            fieldName == "domainEvents" -> null

            else -> error("Unhandled BUSINESS_DOMAIN field for verification: $fieldName")
        }

    override fun collectionItemValues(entity: BusinessDomain): Map<String, String> {
        val boundedContexts =
            FieldValueSupport.items("boundedContext", entity.boundedContexts, { it.key }, { it.key })

        // Context relationships live in their own table and are shown on the domain's context map;
        // enumerate those touching any of the domain's bounded contexts (as upstream or downstream).
        val relRepo = contextRelationshipRepository
        val rels =
            entity.boundedContexts
                .orEmpty()
                .flatMap { bc ->
                    relRepo.findByUpstreamBoundedContextKey(bc.key) + relRepo.findByDownstreamBoundedContextKey(bc.key)
                }.distinctBy { it.id }
        val contextRelationships =
            FieldValueSupport.items(
                "contextRelationship",
                rels,
                { it.id?.toString() },
                { signatureOf(it) }
            )

        return boundedContexts + contextRelationships
    }

    private fun signatureOf(rel: ContextRelationship): String =
        FieldValueSupport.signature(
            rel.upstreamBoundedContext?.key,
            rel.downstreamBoundedContext?.key,
            rel.relationshipType,
            rel.upstreamRole,
            rel.downstreamRole,
            rel.description
        )
}
