package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessDomainVersion
import org.leargon.backend.model.BusinessDomainResponse
import org.leargon.backend.model.BusinessDomainSummaryResponse
import org.leargon.backend.model.BusinessDomainTreeResponse
import org.leargon.backend.model.BusinessDomainType
import org.leargon.backend.model.BusinessDomainVersionResponse
import org.leargon.backend.model.BusinessDomainVersionResponseChangeType
import org.leargon.backend.model.LocalizedBusinessDomainResponse
import org.leargon.backend.service.FieldConfigurationService
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class BusinessDomainMapper(
    private val fieldConfigurationService: FieldConfigurationService,
    private val organisationalUnitMapper: OrganisationalUnitMapper
) {
    fun toBusinessDomainResponse(domain: BusinessDomain): BusinessDomainResponse {
        val fc =
            fieldConfigurationService.compute("BUSINESS_DOMAIN") { fieldName ->
                when {
                    fieldName == "names" -> {
                        domain.names.isNotEmpty()
                    }

                    fieldName == "descriptions" -> {
                        domain.descriptions.isNotEmpty()
                    }

                    fieldName == "type" -> {
                        domain.type != null
                    }

                    fieldName.startsWith("names.") -> {
                        val locale = fieldName.removePrefix("names.")
                        domain.names.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("descriptions.") -> {
                        val locale = fieldName.removePrefix("descriptions.")
                        domain.descriptions.any { it.locale == locale && !it.text.isNullOrBlank() }
                    }

                    fieldName.startsWith("classification.") -> {
                        val classKey = fieldName.removePrefix("classification.")
                        domain.classificationAssignments.any { it.classificationKey == classKey }
                    }

                    else -> {
                        true
                    }
                }
            }
        return BusinessDomainResponse(
            domain.key,
            UserMapper.toUserSummary(domain.createdBy),
            LocalizedTextMapper.toModel(domain.names),
            toZonedDateTime(domain.createdAt),
            toZonedDateTime(domain.updatedAt)
        ).parent(toBusinessDomainSummaryResponse(domain.parent))
            .descriptions(LocalizedTextMapper.toModel(domain.descriptions))
            .type(toBusinessDomainType(domain.type))
            .effectiveType(toBusinessDomainType(domain.getEffectiveType()))
            .visionStatement(domain.visionStatement)
            .owningUnit(organisationalUnitMapper.toSummaryResponse(domain.owningUnit))
            .subdomains(toBusinessDomainSummaryResponseArray(domain.children))
            .boundedContexts(BoundedContextMapper.toSummaryResponseList(domain.boundedContexts))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(domain.classificationAssignments))
            .missingMandatoryFields(fc.missing)
            .mandatoryFields(fc.mandatory)
    }

    fun toLocalizedBusinessDomainResponse(
        domain: BusinessDomain,
        locale: String
    ): LocalizedBusinessDomainResponse =
        LocalizedBusinessDomainResponse(
            domain.key,
            domain.getName(locale),
            toZonedDateTime(domain.createdAt),
            toZonedDateTime(domain.updatedAt)
        ).description(if (domain.descriptions.isEmpty()) null else domain.getDescription(locale))
            .parent(toBusinessDomainSummaryResponse(domain.parent))
            .type(toBusinessDomainType(domain.type))
            .effectiveType(toBusinessDomainType(domain.getEffectiveType()))
            .classificationAssignments(ClassificationMapper.toClassificationAssignmentResponses(domain.classificationAssignments))

    fun toBusinessDomainTreeResponse(domain: BusinessDomain): BusinessDomainTreeResponse =
        BusinessDomainTreeResponse(
            domain.key,
            LocalizedTextMapper.toModel(domain.names),
            toBusinessDomainTreeResponses(domain.children)
        ).parent(toBusinessDomainSummaryResponse(domain.parent))
            .descriptions(LocalizedTextMapper.toModel(domain.descriptions))
            .type(toBusinessDomainType(domain.type))
            .effectiveType(toBusinessDomainType(domain.getEffectiveType()))

    fun toBusinessDomainVersionResponse(version: BusinessDomainVersion): BusinessDomainVersionResponse =
        BusinessDomainVersionResponse(
            version.versionNumber,
            UserMapper.toUserSummary(version.changedBy),
            toDomainChangeType(version.changeType),
            toZonedDateTime(version.createdAt)
        ).changeSummary(version.changeSummary)

    fun toBusinessDomainSummaryResponse(domain: BusinessDomain?): BusinessDomainSummaryResponse? {
        if (domain == null) return null
        return BusinessDomainSummaryResponse(domain.key, domain.getName("en"))
    }

    fun toBusinessDomainTreeResponses(businessDomains: Collection<BusinessDomain>?): List<BusinessDomainTreeResponse> {
        if (businessDomains == null) return emptyList()
        return businessDomains.map { toBusinessDomainTreeResponse(it) }
    }

    fun toBusinessDomainSummaryResponseArray(businessDomains: Collection<BusinessDomain>?): List<BusinessDomainSummaryResponse> {
        if (businessDomains == null) return emptyList()
        return businessDomains.map { toBusinessDomainSummaryResponse(it)!! }
    }

    companion object {
        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)

        @JvmStatic
        fun toBusinessDomainType(businessDomainType: String?): BusinessDomainType? {
            if (businessDomainType == null) return null
            return BusinessDomainType.fromValue(businessDomainType)
        }

        @JvmStatic
        fun toDomainChangeType(changeType: String?): BusinessDomainVersionResponseChangeType? {
            if (changeType == null) return null
            return BusinessDomainVersionResponseChangeType.fromValue(changeType)
        }

        @JvmStatic
        fun toBusinessDomainSummary(domain: BusinessDomain?): BusinessDomainSummaryResponse? {
            if (domain == null) return null
            return BusinessDomainSummaryResponse(domain.key, domain.getName("en"))
        }
    }
}
