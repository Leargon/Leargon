package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDataQualityRule
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.Process
import org.leargon.backend.mapper.ProcessMapper
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Singleton
open class ExportService(
    private val processRepository: ProcessRepository,
    private val serviceProviderRepository: ServiceProviderRepository,
    private val dpiaRepository: DpiaRepository,
    private val fieldConfigurationService: FieldConfigurationService,
    private val contextRelationshipRepository: ContextRelationshipRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val businessEntityRepository: BusinessEntityRepository,
) {
    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    private fun csvField(value: String?): String {
        if (value == null) return ""
        return "\"${value.replace("\"", "\"\"")}\""
    }

    private fun csvRow(vararg fields: String?): String = fields.joinToString(",") { csvField(it) }

    private fun computeMissingFields(process: Process): String {
        val fc =
            fieldConfigurationService.compute("BUSINESS_PROCESS") { fieldName ->
                when {
                    fieldName == "names" -> process.names.isNotEmpty()
                    fieldName == "descriptions" -> process.descriptions.isNotEmpty()
                    fieldName == "boundedContext" -> process.boundedContext != null
                    fieldName == "processOwner" -> process.processOwner != null
                    fieldName == "executingUnits" -> process.executingUnits.isNotEmpty()
                    fieldName == "legalBasis" -> process.legalBasis != null
                    fieldName.startsWith("names.") -> {
                        val l = fieldName.removePrefix("names.")
                        process.names.any { it.locale == l && !it.text.isNullOrBlank() }
                    }
                    fieldName.startsWith("descriptions.") -> {
                        val l = fieldName.removePrefix("descriptions.")
                        process.descriptions.any { it.locale == l && !it.text.isNullOrBlank() }
                    }
                    fieldName.startsWith("classification.") -> {
                        val classKey = fieldName.removePrefix("classification.")
                        process.classificationAssignments.any { it.classificationKey == classKey }
                    }
                    else -> true
                }
            }
        return fc.missing?.joinToString("; ") ?: ""
    }

    private fun rootEntity(e: BusinessEntity): BusinessEntity = if (e.parent == null) e else rootEntity(e.parent!!)

    private fun translateLegalBasis(legalBasis: String?): String? =
        when (legalBasis) {
            "CONSENT" -> "Consent (Art. 6(1)(a) GDPR)"
            "CONTRACT" -> "Contract (Art. 6(1)(b) GDPR)"
            "LEGAL_OBLIGATION" -> "Legal Obligation (Art. 6(1)(c) GDPR)"
            "VITAL_INTEREST" -> "Vital Interests (Art. 6(1)(d) GDPR)"
            "PUBLIC_TASK" -> "Public Task (Art. 6(1)(e) GDPR)"
            "LEGITIMATE_INTEREST" -> "Legitimate Interests (Art. 6(1)(f) GDPR)"
            else -> legalBasis
        }

    fun exportProcessingRegister(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "Process Name",
                "Process Owner",
                "Legal Basis",
                "Purpose",
                "Security Measures",
                "Data Subject Categories",
                "Personal Data Categories",
                "Retention Periods",
                "Service Providers",
                "Cross-border Transfers"
            )
        )
        val processes = processRepository.findAll().filter { it.legalBasis != null }
        for (process in processes) {
            val name = process.names.find { it.locale == locale }?.text ?: process.names.firstOrNull()?.text ?: process.key
            val processOwnerName = process.processOwner?.let { "${it.firstName} ${it.lastName}".trim() } ?: ""
            val allEntities =
                (
                    ProcessMapper.collectEffectiveEntities(process) { it.inputEntities } +
                        ProcessMapper.collectEffectiveEntities(process) { it.outputEntities }
                ).distinctBy { it.key }
            val dataSubjectCategories =
                allEntities
                    .map { rootEntity(it) }
                    .distinctBy { it.key }
                    .joinToString("; ") { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key }
            val personalEntities =
                allEntities.filter { entity ->
                    entity.classificationAssignments.any {
                        it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                    }
                }
            val personalDataCategories =
                personalEntities.joinToString("; ") {
                    it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
                }
            val retentionPeriods =
                allEntities
                    .filter { !it.retentionPeriod.isNullOrBlank() }
                    .joinToString("; ") { e ->
                        val entityName = e.names.find { n -> n.locale == locale }?.text ?: e.names.firstOrNull()?.text ?: e.key
                        "$entityName: ${e.retentionPeriod}"
                    }
            val dataProcessors =
                process.serviceProviders.joinToString("; ") {
                    it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
                }
            val transfers =
                process.crossBorderTransfers?.joinToString("; ") {
                    "${it.destinationCountry}: ${it.safeguard}"
                } ?: ""
            sb.appendLine(
                csvRow(
                    name,
                    processOwnerName,
                    translateLegalBasis(process.legalBasis),
                    process.purpose?.firstOrNull()?.text ?: "",
                    process.securityMeasures?.firstOrNull()?.text ?: "",
                    dataSubjectCategories,
                    personalDataCategories,
                    retentionPeriods,
                    dataProcessors,
                    transfers
                )
            )
        }
        return sb.toString()
    }

    fun exportServiceProviders(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "Service Provider Key",
                "Service Provider Name",
                "Service Provider Type",
                "Processing Countries",
                "Processor Agreement In Place",
                "Sub-processors Approved",
                "Linked Processes"
            )
        )
        val processors = serviceProviderRepository.findAll()
        for (processor in processors) {
            val name = processor.names.find { it.locale == locale }?.text ?: processor.names.firstOrNull()?.text ?: processor.key
            val countries = processor.processingCountries.joinToString("; ")
            val linkedProcesses =
                processor.linkedProcesses.joinToString("; ") {
                    it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
                }
            sb.appendLine(
                csvRow(
                    processor.key,
                    name,
                    processor.serviceProviderType,
                    countries,
                    if (processor.processorAgreementInPlace) "Yes" else "No",
                    if (processor.subProcessorsApproved) "Yes" else "No",
                    linkedProcesses
                )
            )
        }
        return sb.toString()
    }

    fun exportContextMap(locale: String = "en"): String {
        val rels = contextRelationshipRepository.findAll()
        val allBoundedContexts = boundedContextRepository.findAll()
        val allDomains = businessDomainRepository.findAll()

        val sb = StringBuilder()

        // ContextMap block
        sb.appendLine("ContextMap LeargonContextMap {")
        if (allBoundedContexts.isNotEmpty()) {
            sb.appendLine("  contains ${allBoundedContexts.joinToString(", ") { toCmlIdentifier(it.getName(locale)) }}")
            sb.appendLine()
        }
        for (rel in rels) {
            val up = rel.upstreamBoundedContext ?: continue
            val down = rel.downstreamBoundedContext ?: continue
            val upId = toCmlIdentifier(up.getName(locale))
            val downId = toCmlIdentifier(down.getName(locale))
            if (rel.relationshipType == "SEPARATE_WAYS") continue
            val line =
                when (rel.relationshipType) {
                    "PARTNERSHIP" -> "  $upId Partnership $downId"
                    "SHARED_KERNEL" -> "  $upId [SK] <-> [SK] $downId"
                    "BIG_BALL_OF_MUD" -> "  $upId <-> $downId : BigBallOfMud"
                    "CUSTOMER_SUPPLIER" -> "  $upId [U,S] -> [D,C] $downId"
                    "CONFORMIST" -> "  $upId [U] -> [D,CF] $downId"
                    "ANTICORRUPTION_LAYER" -> "  $upId [U] -> [D,ACL] $downId"
                    "OPEN_HOST_SERVICE" -> "  $upId [U,OHS] -> [D] $downId"
                    "PUBLISHED_LANGUAGE" -> "  $upId [U,OHS,PL] -> [D] $downId"
                    else -> "  $upId -> $downId"
                }
            sb.appendLine(line)
        }
        sb.appendLine("}")
        sb.appendLine()

        // Group entities by BC key
        val entitiesByBcKey =
            businessEntityRepository
                .findAll()
                .filter { it.boundedContext != null }
                .groupBy { it.boundedContext!!.key }

        // Index domains and determine root/child status in-memory
        val domainByKey = allDomains.associateBy { it.key }
        val childDomainsByParentKey =
            allDomains
                .filter { it.parent != null }
                .groupBy { it.parent!!.key }
        val bcsByDomainKey =
            allBoundedContexts
                .filter { it.domain != null }
                .groupBy { it.domain!!.key }
        val rootDomainKeys = allDomains.filter { it.parent == null }.map { it.key }.toSet()

        // Build map: BC key → CML subdomain identifier
        // - BC in a child domain  → subdomain name = child domain's own name
        // - BC directly in a root domain → old-style ${bcName}Subdomain
        val bcKeyToSubdomainId = mutableMapOf<String, String>()
        for (bc in allBoundedContexts) {
            val domainKey = bc.domain?.key ?: continue
            bcKeyToSubdomainId[bc.key] =
                if (domainKey !in rootDomainKeys) {
                    toCmlIdentifier((domainByKey[domainKey] ?: continue).getName(locale))
                } else {
                    "${toCmlIdentifier(bc.getName(locale))}Subdomain"
                }
        }

        // Domain blocks (root domains only) — defined before BoundedContext blocks
        val rootDomains = allDomains.filter { it.parent == null }
        for (rootDomain in rootDomains) {
            val children = childDomainsByParentKey[rootDomain.key]?.sortedBy { it.getName(locale) } ?: emptyList()
            val directBcs = bcsByDomainKey[rootDomain.key]?.sortedBy { it.getName(locale) } ?: emptyList()
            if (children.isEmpty() && directBcs.isEmpty()) continue

            val domainId = toCmlIdentifier(rootDomain.getName(locale))
            sb.appendLine("Domain $domainId {")
            if (!rootDomain.visionStatement.isNullOrBlank()) {
                sb.appendLine("  domainVisionStatement = \"${rootDomain.visionStatement!!.replace("\"", "\\\"")}\"")
            }

            if (children.isNotEmpty()) {
                // Hierarchical model: child domains become CML Subdomains
                for (child in children) {
                    val childId = toCmlIdentifier(child.getName(locale))
                    sb.appendLine("  Subdomain $childId {")
                    val subdomainTypeLine =
                        when (child.type?.uppercase()) {
                            "CORE" -> "    type = CORE_DOMAIN"
                            "SUPPORTING" -> "    type = SUPPORTING_DOMAIN"
                            "SUPPORT" -> "    type = SUPPORTING_DOMAIN"
                            "GENERIC" -> "    type = GENERIC_SUBDOMAIN"
                            else -> null
                        }
                    if (subdomainTypeLine != null) sb.appendLine(subdomainTypeLine)
                    // domainVisionStatement from the first (alphabetically) BC in this child domain
                    val childBcs = bcsByDomainKey[child.key]?.sortedBy { it.getName(locale) } ?: emptyList()
                    val firstBcDesc =
                        childBcs
                            .firstOrNull()
                            ?.descriptions
                            ?.find { it.locale == locale }
                            ?.text
                            ?: childBcs
                                .firstOrNull()
                                ?.descriptions
                                ?.firstOrNull()
                                ?.text
                    if (!firstBcDesc.isNullOrBlank()) {
                        sb.appendLine("    domainVisionStatement = \"${firstBcDesc.replace("\"", "\\\"")}\"")
                    }
                    // Problem-space entities from all BCs in this child domain
                    for (bc in childBcs) {
                        for (entity in entitiesByBcKey[bc.key] ?: emptyList()) {
                            val entityId =
                                toCmlIdentifier(
                                    entity.names.find { n -> n.locale == locale }?.text
                                        ?: entity.names.firstOrNull()?.text
                                        ?: entity.key,
                                )
                            sb.appendLine("    Entity $entityId { }")
                        }
                    }
                    sb.appendLine("  }")
                }
            } else {
                // Flat model: BCs directly in the domain become their own Subdomains
                for (bc in directBcs) {
                    val bcId = toCmlIdentifier(bc.getName(locale))
                    sb.appendLine("  Subdomain ${bcId}Subdomain {")
                    val subdomainTypeLine =
                        when (rootDomain.type?.uppercase()) {
                            "CORE" -> "    type = CORE_DOMAIN"
                            "SUPPORTING" -> "    type = SUPPORTING_DOMAIN"
                            "SUPPORT" -> "    type = SUPPORTING_DOMAIN"
                            "GENERIC" -> "    type = GENERIC_SUBDOMAIN"
                            else -> null
                        }
                    if (subdomainTypeLine != null) sb.appendLine(subdomainTypeLine)
                    val firstBcDesc = bc.descriptions.firstOrNull()?.text
                    if (!firstBcDesc.isNullOrBlank()) {
                        sb.appendLine("    domainVisionStatement = \"${firstBcDesc.replace("\"", "\\\"")}\"")
                    }
                    for (entity in entitiesByBcKey[bc.key] ?: emptyList()) {
                        val entityId =
                            toCmlIdentifier(
                                entity.names.find { n -> n.locale == locale }?.text
                                    ?: entity.names.firstOrNull()?.text
                                    ?: entity.key,
                            )
                        sb.appendLine("    Entity $entityId { }")
                    }
                    sb.appendLine("  }")
                }
            }
            sb.appendLine("}")
            sb.appendLine()
        }

        // BoundedContext blocks — implements SubdomainName when a domain mapping exists
        for (bc in allBoundedContexts) {
            val id = toCmlIdentifier(bc.getName(locale))
            val subdomainId = bcKeyToSubdomainId[bc.key]
            val header = if (subdomainId != null) "BoundedContext $id implements $subdomainId {" else "BoundedContext $id {"
            sb.appendLine(header)
            val validContextTypes = setOf("FEATURE", "APPLICATION", "SYSTEM", "TEAM")
            if (bc.contextType != null && validContextTypes.contains(bc.contextType!!.uppercase())) {
                sb.appendLine("  type = ${bc.contextType!!.uppercase()}")
            }
            val firstDesc = bc.descriptions.firstOrNull()?.text
            if (!firstDesc.isNullOrBlank()) {
                sb.appendLine("  domainVisionStatement = \"${firstDesc.replace("\"", "\\\"")}\"")
            }
            val owningUnitName =
                bc.owningUnit?.let { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text }
            if (!owningUnitName.isNullOrBlank()) {
                sb.appendLine("  responsibilities = \"${owningUnitName.replace("\"", "\\\"")}\"")
            }
            val bcEntities = entitiesByBcKey[bc.key] ?: emptyList()
            for (entity in bcEntities) {
                val entityId =
                    toCmlIdentifier(
                        entity.names.find { n -> n.locale == locale }?.text ?: entity.names.firstOrNull()?.text ?: entity.key,
                    )
                sb.appendLine("  Aggregate ${entityId}Aggregate {")
                sb.appendLine("    Entity $entityId {")
                sb.appendLine("      aggregateRoot")
                sb.appendLine("    }")
                sb.appendLine("  }")
            }
            sb.appendLine("}")
            sb.appendLine()
        }

        return sb.toString()
    }

    private fun toCmlIdentifier(name: String): String = name.replace(Regex("[^A-Za-z0-9]"), "_").replace(Regex("_+"), "_").trim('_')

    fun exportBusinessDataQualityRules(rules: List<BusinessDataQualityRule>): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "Entity Key",
                "Entity Name",
                "Description",
                "Severity"
            )
        )
        for (rule in rules) {
            val entity = rule.businessEntity
            val entityKey = entity?.key ?: ""
            val entityName = entity?.names?.firstOrNull()?.text ?: entityKey
            sb.appendLine(
                csvRow(
                    entityKey,
                    entityName,
                    rule.description,
                    rule.severity
                )
            )
        }
        return sb.toString()
    }

    fun exportDpiaRegister(): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "DPIA Key",
                "Related Resource Key",
                "Related Resource Type",
                "Status",
                "Initial Risk",
                "Residual Risk",
                "Measures",
                "Risk Description",
                "DPA Consultation Required",
                "DPA Consultation Completed",
                "DPA Consultation Date",
                "DPA Consultation Outcome",
                "Triggered By",
                "Created At"
            )
        )
        val dpias = dpiaRepository.findAll()
        for (dpia in dpias) {
            val (relatedKey, relatedType) =
                when {
                    dpia.process != null -> Pair(dpia.process!!.key, "PROCESS")
                    dpia.entity != null -> Pair(dpia.entity!!.key, "BUSINESS_ENTITY")
                    else -> Pair("", "")
                }
            val triggeredBy = dpia.triggeredBy?.let { "${it.firstName} ${it.lastName} (${it.username})" } ?: ""
            val createdAt = dpia.createdAt?.atZone(ZoneOffset.UTC)?.format(dateFormatter) ?: ""
            val fdpicDate = dpia.fdpicConsultationDate?.format(dateFormatter) ?: ""
            val statusLabel =
                when (dpia.status) {
                    "IN_PROGRESS" -> "In Progress"
                    "COMPLETED" -> "Completed"
                    else -> dpia.status
                }
            val riskLabel =
                when (dpia.residualRisk) {
                    "LOW" -> "Low"
                    "MEDIUM" -> "Medium"
                    "HIGH" -> "High"
                    else -> dpia.residualRisk
                }
            val initialRiskLabel =
                when (dpia.initialRisk) {
                    "LOW" -> "Low"
                    "MEDIUM" -> "Medium"
                    "HIGH" -> "High"
                    else -> dpia.initialRisk
                }
            sb.appendLine(
                csvRow(
                    dpia.key,
                    relatedKey,
                    relatedType,
                    statusLabel,
                    initialRiskLabel,
                    riskLabel,
                    dpia.measures,
                    dpia.riskDescription,
                    dpia.fdpicConsultationRequired?.let { if (it) "Yes" else "No" },
                    dpia.fdpicConsultationCompleted?.let { if (it) "Yes" else "No" },
                    fdpicDate,
                    dpia.fdpicConsultationOutcome,
                    triggeredBy,
                    createdAt
                )
            )
        }
        return sb.toString()
    }
}
