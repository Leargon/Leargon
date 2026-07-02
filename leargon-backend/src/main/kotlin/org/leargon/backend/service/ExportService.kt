package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessDataQualityRule
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.repository.UserRepository
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Singleton
open class ExportService(
    private val processRepository: ProcessRepository,
    private val serviceProviderRepository: ServiceProviderRepository,
    private val dpiaRepository: DpiaRepository,
    private val contextRelationshipRepository: ContextRelationshipRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processingRegisterService: ProcessingRegisterService,
    private val userRepository: UserRepository,
) {
    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    private fun csvField(value: String?): String {
        if (value == null) return ""
        return "\"${value.replace("\"", "\"\"")}\""
    }

    private fun csvRow(vararg fields: String?): String = fields.joinToString(",") { csvField(it) }

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

    private fun processingRegisterHeaders(locale: String): Array<String?> =
        when (locale) {
            "de" -> {
                arrayOf(
                    "Letzte Änderung",
                    "Änderung durch",
                    "Bereich",
                    "Bezeichnung der Bearbeitungstätigkeit",
                    "Verantwortliche",
                    "EU-Vertreter",
                    "Datenschutzbeauftragter/-berater",
                    "gemeinsame Verwantwortliche",
                    "Bearbeitungszweck/e",
                    "Kategorien betroffener Personen",
                    "Kategorien von Personendaten",
                    "Kategorien von Empfängern",
                    "Übermittlung ins Ausland (Länder und Grundlagen der Übermittlung)",
                    "Aufbewahrungsdauer bzw. Kriterien",
                    "Datensicherheitsmassnahmen",
                )
            }

            "fr" -> {
                arrayOf(
                    "Dernière modification",
                    "Modifié par",
                    "Département",
                    "Désignation de l'activité de traitement",
                    "Responsable",
                    "Représentant UE",
                    "Délégué à la protection des données",
                    "Responsables conjoints",
                    "Finalités du traitement",
                    "Catégories de personnes concernées",
                    "Catégories de données personnelles",
                    "Catégories de destinataires",
                    "Transferts vers des pays tiers (pays et bases légales)",
                    "Durée de conservation / critères",
                    "Mesures de sécurité",
                )
            }

            else -> {
                arrayOf(
                    "Last Modified",
                    "Changed By",
                    "Department",
                    "Processing Activity",
                    "Responsible",
                    "EU Representative",
                    "Data Protection Officer/Advisor",
                    "Joint Controllers",
                    "Processing Purposes",
                    "Categories of Data Subjects",
                    "Categories of Personal Data",
                    "Categories of Recipients",
                    "Transfers to Third Countries (Countries and Legal Basis)",
                    "Retention Period / Criteria",
                    "Security Measures",
                )
            }
        }

    private fun serviceProviderHeaders(locale: String): Array<String?> =
        when (locale) {
            "de" -> {
                arrayOf(
                    "Auftragsverarbeiter-Schlüssel",
                    "Auftragsverarbeiter-Name",
                    "Typ",
                    "Verarbeitungsländer",
                    "Auftragsverarbeitungsvertrag vorhanden",
                    "Unterauftragsverarbeiter genehmigt",
                    "Verknüpfte Prozesse",
                    "Datenkategorien (Eingabe)",
                    "Datenkategorien (Ausgabe)",
                    "Rechtsgrundlagen",
                    "Drittland-Übermittlungen",
                    "Übermittlungsmechanismen",
                )
            }

            "fr" -> {
                arrayOf(
                    "Clé du sous-traitant",
                    "Nom du sous-traitant",
                    "Type",
                    "Pays de traitement",
                    "Accord de sous-traitance en place",
                    "Sous-traitants approuvés",
                    "Processus liés",
                    "Entités de données (entrée)",
                    "Entités de données (sortie)",
                    "Bases légales",
                    "Pays de transfert transfrontalier",
                    "Mécanismes de transfert",
                )
            }

            else -> {
                arrayOf(
                    "Service Provider Key",
                    "Service Provider Name",
                    "Service Provider Type",
                    "Processing Countries",
                    "Processor Agreement In Place",
                    "Sub-processors Approved",
                    "Linked Processes",
                    "Data Entities (Input)",
                    "Data Entities (Output)",
                    "Legal Bases",
                    "Cross-border Transfer Countries",
                    "Transfer Mechanisms",
                )
            }
        }

    private fun dpiaRegisterHeaders(locale: String): Array<String?> =
        when (locale) {
            "de" -> {
                arrayOf(
                    "DSFA-Schlüssel",
                    "Ressource-Schlüssel",
                    "Ressource-Typ",
                    "Status",
                    "Initiales Risiko",
                    "Restrisiko",
                    "Maßnahmen",
                    "Risikobeschreibung",
                    "EDÖB-Konsultation erforderlich",
                    "EDÖB-Konsultation abgeschlossen",
                    "EDÖB-Konsultationsdatum",
                    "EDÖB-Konsultationsergebnis",
                    "Ausgelöst von",
                    "Erstellt am",
                )
            }

            "fr" -> {
                arrayOf(
                    "Clé AIPD",
                    "Clé de la ressource liée",
                    "Type de ressource liée",
                    "Statut",
                    "Risque initial",
                    "Risque résiduel",
                    "Mesures",
                    "Description du risque",
                    "Consultation CNIL requise",
                    "Consultation CNIL terminée",
                    "Date de consultation CNIL",
                    "Résultat de la consultation CNIL",
                    "Déclenché par",
                    "Créé le",
                )
            }

            else -> {
                arrayOf(
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
                    "Created At",
                )
            }
        }

    private fun yesNo(
        value: Boolean,
        locale: String
    ): String =
        when (locale) {
            "de" -> if (value) "Ja" else "Nein"
            "fr" -> if (value) "Oui" else "Non"
            else -> if (value) "Yes" else "No"
        }

    private fun translateStatus(
        status: String?,
        locale: String
    ): String? =
        when (status) {
            "IN_PROGRESS" -> {
                when (locale) {
                    "de" -> "In Bearbeitung"
                    "fr" -> "En cours"
                    else -> "In Progress"
                }
            }

            "COMPLETED" -> {
                when (locale) {
                    "de" -> "Abgeschlossen"
                    "fr" -> "Terminé"
                    else -> "Completed"
                }
            }

            else -> {
                status
            }
        }

    private fun translateRisk(
        risk: String?,
        locale: String
    ): String? =
        when (risk) {
            "LOW" -> {
                when (locale) {
                    "de" -> "Niedrig"
                    "fr" -> "Faible"
                    else -> "Low"
                }
            }

            "MEDIUM" -> {
                when (locale) {
                    "de" -> "Mittel"
                    "fr" -> "Moyen"
                    else -> "Medium"
                }
            }

            "HIGH" -> {
                when (locale) {
                    "de" -> "Hoch"
                    "fr" -> "Élevé"
                    else -> "High"
                }
            }

            else -> {
                risk
            }
        }

    @jakarta.transaction.Transactional
    open fun exportProcessingRegister(locale: String = "en"): String {
        val adminUser =
            userRepository.findAll().firstOrNull { it.roles.contains("ROLE_ADMIN") }
                ?: userRepository.findAll().first()
        val entries =
            processingRegisterService
                .getEntries(locale, adminUser)
                .filter { it.personCategories.isNotBlank() || it.dataCategories.isNotBlank() }

        val exportDate = dateFormatter.format(java.time.LocalDate.now())
        val (titleLine, scopeLine, dateLine) =
            when (locale) {
                "de" -> {
                    Triple(
                        "Verzeichnis der Bearbeitungstätigkeiten gemäss Art. 30 DSGVO / Art. 12 DSG",
                        "Enthält nur Bearbeitungstätigkeiten mit Personenbezug",
                        "Exportdatum: $exportDate",
                    )
                }

                "fr" -> {
                    Triple(
                        "Registre des activités de traitement conformément à l'Art. 30 RGPD / Art. 12 LPD",
                        "Contient uniquement les activités de traitement impliquant des données personnelles",
                        "Date d'exportation: $exportDate",
                    )
                }

                else -> {
                    Triple(
                        "Record of Processing Activities pursuant to Art. 30 GDPR / Art. 12 DSG",
                        "Contains only processing activities involving personal data",
                        "Export date: $exportDate",
                    )
                }
            }

        val sb = StringBuilder()
        sb.appendLine(csvField(titleLine))
        sb.appendLine(csvField(scopeLine))
        sb.appendLine(csvField(dateLine))
        sb.appendLine()
        sb.appendLine(csvRow(*processingRegisterHeaders(locale)))
        for (entry in entries) {
            sb.appendLine(
                csvRow(
                    entry.lastModified,
                    entry.changedBy,
                    entry.department,
                    entry.name,
                    entry.responsible,
                    entry.euRepresentative,
                    entry.dpo,
                    entry.jointControllers,
                    entry.purposes,
                    entry.personCategories,
                    entry.dataCategories,
                    entry.recipients,
                    entry.crossBorderTransfers,
                    entry.retentionPeriods,
                    entry.securityMeasures
                )
            )
        }
        return sb.toString()
    }

    @jakarta.transaction.Transactional
    open fun exportServiceProviders(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(csvRow(*serviceProviderHeaders(locale)))
        val processors = serviceProviderRepository.findAll()
        for (processor in processors) {
            val name = processor.names.find { it.locale == locale }?.text ?: processor.names.firstOrNull()?.text ?: processor.key
            val countries = processor.processingCountries.joinToString("; ")
            val linkedProcesses =
                processor.linkedProcesses.joinToString("; ") {
                    it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
                }
            val inputEntities =
                processor.linkedProcesses
                    .flatMap { it.inputEntities }
                    .distinctBy { it.key }
                    .joinToString("; ") { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key }
            val outputEntities =
                processor.linkedProcesses
                    .flatMap { it.outputEntities }
                    .distinctBy { it.key }
                    .joinToString("; ") { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key }
            val legalBases =
                processor.linkedProcesses
                    .mapNotNull { it.legalBasis }
                    .distinct()
                    .joinToString("; ") { translateLegalBasis(it) ?: it }
            val transferCountries =
                processor.linkedProcesses
                    .flatMap { it.crossBorderTransfers.orEmpty() }
                    .map { it.destinationCountry }
                    .distinct()
                    .joinToString("; ")
            val transferMechanisms =
                processor.linkedProcesses
                    .flatMap { it.crossBorderTransfers.orEmpty() }
                    .map { it.safeguard }
                    .distinct()
                    .joinToString("; ")
            sb.appendLine(
                csvRow(
                    processor.key,
                    name,
                    processor.serviceProviderType,
                    countries,
                    yesNo(processor.processorAgreementInPlace, locale),
                    yesNo(processor.subProcessorsApproved, locale),
                    linkedProcesses,
                    inputEntities,
                    outputEntities,
                    legalBases,
                    transferCountries,
                    transferMechanisms
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
            val visionText =
                rootDomain.visionStatement.find { it.locale == locale }?.text
                    ?: rootDomain.visionStatement.firstOrNull()?.text
            if (!visionText.isNullOrBlank()) {
                sb.appendLine("  domainVisionStatement = \"${visionText.replace("\"", "\\\"")}\"")
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
                    rule.descriptions.find { it.locale == "en" }?.text ?: rule.descriptions.firstOrNull()?.text ?: "",
                    rule.severity
                )
            )
        }
        return sb.toString()
    }

    fun exportDpiaRegister(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(csvRow(*dpiaRegisterHeaders(locale)))
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
            val statusLabel = translateStatus(dpia.status, locale)
            val riskLabel = translateRisk(dpia.residualRisk, locale)
            val initialRiskLabel = translateRisk(dpia.initialRisk, locale)
            sb.appendLine(
                csvRow(
                    dpia.key,
                    relatedKey,
                    relatedType,
                    statusLabel,
                    initialRiskLabel,
                    riskLabel,
                    dpia.measures.find { it.locale == locale }?.text ?: dpia.measures.firstOrNull()?.text ?: "",
                    dpia.riskDescription.find { it.locale == locale }?.text ?: dpia.riskDescription.firstOrNull()?.text ?: "",
                    dpia.fdpicConsultationRequired?.let { if (it) "Yes" else "No" },
                    dpia.fdpicConsultationCompleted?.let { if (it) "Yes" else "No" },
                    fdpicDate,
                    dpia.fdpicConsultationOutcome.find { it.locale == locale }?.text ?: dpia.fdpicConsultationOutcome.firstOrNull()?.text
                        ?: "",
                    triggeredBy,
                    createdAt
                )
            )
        }
        return sb.toString()
    }
}
