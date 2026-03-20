package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.Process
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.DataProcessorRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Singleton
open class ExportService(
    private val processRepository: ProcessRepository,
    private val dataProcessorRepository: DataProcessorRepository,
    private val dpiaRepository: DpiaRepository,
    private val fieldConfigurationService: FieldConfigurationService,
    private val contextRelationshipRepository: ContextRelationshipRepository,
) {

    private val dateFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    private fun csvField(value: String?): String {
        if (value == null) return ""
        return "\"${value.replace("\"", "\"\"")}\""
    }

    private fun csvRow(vararg fields: String?): String = fields.joinToString(",") { csvField(it) }

    private fun computeMissingFields(process: Process): String {
        val fc = fieldConfigurationService.compute("BUSINESS_PROCESS") { fieldName ->
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

    fun exportProcessingRegister(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(csvRow(
            "Process Name", "Legal Basis", "Purpose", "Security Measures",
            "Data Subject Categories", "Personal Data Categories",
            "Data Processors", "Cross-border Transfers"
        ))
        val processes = processRepository.findAll()
        for (process in processes) {
            val name = process.names.find { it.locale == locale }?.text ?: process.names.firstOrNull()?.text ?: process.key
            val allEntities = (process.inputEntities + process.outputEntities).distinctBy { it.key }
            val dataSubjectCategories = allEntities
                .map { rootEntity(it) }.distinctBy { it.key }
                .joinToString("; ") { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key }
            val personalDataCategories = allEntities
                .joinToString("; ") { it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key }
            val dataProcessors = process.dataProcessors.joinToString("; ") {
                it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
            }
            val transfers = process.crossBorderTransfers?.joinToString("; ") {
                "${it.destinationCountry}: ${it.safeguard}"
            } ?: ""
            sb.appendLine(csvRow(
                name, process.legalBasis, process.purpose, process.securityMeasures,
                dataSubjectCategories, personalDataCategories,
                dataProcessors, transfers
            ))
        }
        return sb.toString()
    }

    fun exportDataProcessors(locale: String = "en"): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "Processor Key", "Processor Name", "Processing Countries",
                "Processor Agreement In Place", "Sub-processors Approved",
                "Linked Processes", "Linked Business Entities"
            )
        )
        val processors = dataProcessorRepository.findAll()
        for (processor in processors) {
            val name = processor.names.find { it.locale == locale }?.text ?: processor.names.firstOrNull()?.text ?: processor.key
            val countries = processor.processingCountries.joinToString("; ")
            val linkedProcesses = processor.linkedProcesses.joinToString("; ") {
                it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
            }
            val linkedEntities = processor.linkedBusinessEntities.joinToString("; ") {
                it.names.find { n -> n.locale == locale }?.text ?: it.names.firstOrNull()?.text ?: it.key
            }
            sb.appendLine(
                csvRow(
                    processor.key, name, countries,
                    processor.processorAgreementInPlace.toString(),
                    processor.subProcessorsApproved.toString(),
                    linkedProcesses, linkedEntities
                )
            )
        }
        return sb.toString()
    }

    fun exportContextMap(locale: String = "en"): String {
        val rels = contextRelationshipRepository.findAll()
        val boundedContexts = rels.flatMap { listOfNotNull(it.upstreamBoundedContext, it.downstreamBoundedContext) }
            .distinctBy { it.key }

        val sb = StringBuilder()
        sb.appendLine("ContextMap LeargonContextMap {")
        if (boundedContexts.isNotEmpty()) {
            sb.appendLine("  contains ${boundedContexts.joinToString(", ") { toCmlIdentifier(it.getName(locale)) }}")
            sb.appendLine()
        }
        for (rel in rels) {
            val up = rel.upstreamBoundedContext ?: continue
            val down = rel.downstreamBoundedContext ?: continue
            val upId = toCmlIdentifier(up.getName(locale))
            val downId = toCmlIdentifier(down.getName(locale))
            val line = when (rel.relationshipType) {
                "PARTNERSHIP" -> "  $upId <-> $downId : Partnership"
                "SHARED_KERNEL" -> "  $upId [SK] <-> [SK] $downId : Shared-Kernel"
                "CUSTOMER_SUPPLIER" -> "  $upId [U, S] -> [D, C] $downId : Customer-Supplier"
                "CONFORMIST" -> "  $upId [U] -> [D, CF] $downId : Conformist"
                "ANTICORRUPTION_LAYER" -> "  $upId [U] -> [D, ACL] $downId : Anticorruption-Layer"
                "OPEN_HOST_SERVICE" -> "  $upId [U, OHS] -> [D] $downId : Open-Host-Service"
                "PUBLISHED_LANGUAGE" -> "  $upId [U, OHS, PL] -> [D] $downId : Published-Language"
                "BIG_BALL_OF_MUD" -> "  $upId [BBM] <-> [BBM] $downId : Big-Ball-Of-Mud"
                else -> "  $upId -> $downId"
            }
            sb.appendLine(line)
        }
        sb.appendLine("}")
        sb.appendLine()
        for (bc in boundedContexts) {
            val id = toCmlIdentifier(bc.getName(locale))
            sb.appendLine("BoundedContext $id {")
            if (bc.contextType != null) sb.appendLine("  type = ${bc.contextType!!.lowercase().replaceFirstChar { it.uppercase() }}")
            sb.appendLine("}")
            sb.appendLine()
        }
        return sb.toString()
    }

    private fun toCmlIdentifier(name: String): String =
        name.replace(Regex("[^A-Za-z0-9]"), "_").replace(Regex("_+"), "_").trim('_')

    fun exportDpiaRegister(): String {
        val sb = StringBuilder()
        sb.appendLine(
            csvRow(
                "DPIA Key", "Related Resource Key", "Related Resource Type",
                "Status", "Residual Risk", "Measures",
                "Risk Description",
                "FDPIC Consultation Required", "FDPIC Consultation Completed",
                "FDPIC Consultation Date", "FDPIC Consultation Outcome",
                "Triggered By", "Created At"
            )
        )
        val dpias = dpiaRepository.findAll()
        for (dpia in dpias) {
            val (relatedKey, relatedType) = when {
                dpia.process != null -> Pair(dpia.process!!.key, "PROCESS")
                dpia.entity != null -> Pair(dpia.entity!!.key, "BUSINESS_ENTITY")
                else -> Pair("", "")
            }
            val triggeredBy = dpia.triggeredBy?.let { "${it.firstName} ${it.lastName} (${it.username})" } ?: ""
            val createdAt = dpia.createdAt?.atZone(ZoneOffset.UTC)?.format(dateFormatter) ?: ""
            val fdpicDate = dpia.fdpicConsultationDate?.format(dateFormatter) ?: ""
            sb.appendLine(
                csvRow(
                    dpia.key, relatedKey, relatedType,
                    dpia.status, dpia.residualRisk,
                    dpia.measures, dpia.riskDescription,
                    dpia.fdpicConsultationRequired?.toString(),
                    dpia.fdpicConsultationCompleted?.toString(),
                    fdpicDate, dpia.fdpicConsultationOutcome,
                    triggeredBy, createdAt
                )
            )
        }
        return sb.toString()
    }
}
