package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.model.ActivityItem
import org.leargon.backend.model.ActivityItemResourceType
import org.leargon.backend.model.AttentionItem
import org.leargon.backend.model.AttentionItemIssueCode
import org.leargon.backend.model.AttentionItemResourceType
import org.leargon.backend.model.AttentionItemSeverity
import org.leargon.backend.model.BusinessEntitySummaryResponse
import org.leargon.backend.model.DashboardResponse
import org.leargon.backend.model.MaturityMetricItem
import org.leargon.backend.model.MaturityMetricsResponse
import org.leargon.backend.model.MyResponsibilitiesResponse
import org.leargon.backend.model.ProcessSummaryResponse
import org.leargon.backend.model.UserSummaryResponse
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.DpiaRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.UserRepository
import java.time.ZoneOffset

@Singleton
open class DashboardService(
    private val processRepository: ProcessRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessEntityVersionRepository: BusinessEntityVersionRepository,
    private val processVersionRepository: ProcessVersionRepository,
    private val businessDomainVersionRepository: BusinessDomainVersionRepository,
    private val dpiaRepository: DpiaRepository,
    private val userRepository: UserRepository,
    private val businessDomainRepository: BusinessDomainRepository,
) {
    fun getDashboard(
        email: String,
        locale: String = "en"
    ): DashboardResponse {
        // Capture for AOP proxy safety
        val procRepo = this.processRepository
        val entityRepo = this.businessEntityRepository
        val entityVersionRepo = this.businessEntityVersionRepository
        val processVersionRepo = this.processVersionRepository
        val domainVersionRepo = this.businessDomainVersionRepository
        val dpiaRepo = this.dpiaRepository
        val userRepo = this.userRepository

        fun nameOf(
            names: List<LocalizedText>,
            fallback: String
        ): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: fallback

        val currentUser = userRepo.findByEmail(email).orElse(null)
        val userId = currentUser?.id

        // --- Needs Attention ---
        val needsAttention = mutableListOf<AttentionItem>()

        // Processes with personal data but no legal basis
        val processes = procRepo.findAll()
        processes
            .filter { process ->
                process.legalBasis == null &&
                    (process.inputEntities + process.outputEntities).any { entity ->
                        entity.classificationAssignments.any {
                            it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                        }
                    }
            }.forEach { process ->
                needsAttention.add(
                    AttentionItem(
                        AttentionItemResourceType.PROCESS,
                        process.key,
                        nameOf(process.names, process.key),
                        AttentionItemIssueCode.NO_LEGAL_BASIS,
                        AttentionItemSeverity.ERROR,
                    ),
                )
            }

        // Active DPIAs
        dpiaRepo
            .findAll()
            .filter { it.status == "IN_PROGRESS" }
            .forEach { dpia ->
                val (type, key, name) =
                    when {
                        dpia.process != null ->
                            Triple(
                                AttentionItemResourceType.PROCESS,
                                dpia.process!!.key,
                                nameOf(dpia.process!!.names, dpia.process!!.key),
                            )
                        dpia.entity != null ->
                            Triple(
                                AttentionItemResourceType.ENTITY,
                                dpia.entity!!.key,
                                nameOf(dpia.entity!!.names, dpia.entity!!.key),
                            )
                        else -> Triple(AttentionItemResourceType.DPIA, dpia.key, dpia.key)
                    }
                needsAttention.add(
                    AttentionItem(
                        type,
                        key,
                        name,
                        AttentionItemIssueCode.DPIA_IN_PROGRESS,
                        AttentionItemSeverity.WARNING,
                    ),
                )
            }

        // --- Recent Activity (last 10 across all version tables) ---
        fun toUserSummary(user: org.leargon.backend.domain.User?) =
            if (user == null) {
                null
            } else {
                UserSummaryResponse(user.username, user.firstName, user.lastName, user.preferredLanguage)
            }

        val entityActivity =
            entityVersionRepo
                .findAll()
                .sortedByDescending { it.createdAt }
                .take(10)
                .map { v ->
                    ActivityItem(
                        ActivityItemResourceType.ENTITY,
                        v.businessEntity!!.key,
                        nameOf(v.businessEntity!!.names, v.businessEntity!!.key),
                        v.changeType,
                        v.createdAt!!.atZone(ZoneOffset.UTC),
                    ).also { it.changedBy = toUserSummary(v.changedBy) }
                }

        val processActivity =
            processVersionRepo
                .findAll()
                .sortedByDescending { it.createdAt }
                .take(10)
                .map { v ->
                    ActivityItem(
                        ActivityItemResourceType.PROCESS,
                        v.process!!.key,
                        nameOf(v.process!!.names, v.process!!.key),
                        v.changeType,
                        v.createdAt!!.atZone(ZoneOffset.UTC),
                    ).also { it.changedBy = toUserSummary(v.changedBy) }
                }

        val domainActivity =
            domainVersionRepo
                .findAll()
                .sortedByDescending { it.createdAt }
                .take(10)
                .map { v ->
                    ActivityItem(
                        ActivityItemResourceType.DOMAIN,
                        v.businessDomain!!.key,
                        nameOf(v.businessDomain!!.names, v.businessDomain!!.key),
                        v.changeType,
                        v.createdAt!!.atZone(ZoneOffset.UTC),
                    ).also { it.changedBy = toUserSummary(v.changedBy) }
                }

        val recentActivity =
            (entityActivity + processActivity + domainActivity)
                .sortedByDescending { it.changedAt }
                .take(10)

        // --- My Responsibilities ---
        val myEntities =
            if (userId != null) {
                entityRepo.findByDataOwnerId(userId).map { entity ->
                    BusinessEntitySummaryResponse(entity.key, nameOf(entity.names, entity.key))
                }
            } else {
                emptyList()
            }

        val myProcesses =
            if (userId != null) {
                procRepo.findByProcessOwnerId(userId).map { process ->
                    ProcessSummaryResponse(process.key, nameOf(process.names, process.key))
                }
            } else {
                emptyList()
            }

        return DashboardResponse(
            needsAttention,
            recentActivity,
            MyResponsibilitiesResponse(myEntities, myProcesses),
        )
    }

    fun getMaturityMetrics(): MaturityMetricsResponse {
        val entityRepo = this.businessEntityRepository
        val procRepo = this.processRepository
        val domainRepo = this.businessDomainRepository
        val dpiaRepo = this.dpiaRepository

        val allEntities = entityRepo.findAll()
        val allProcesses = procRepo.findAll()
        val allDomains = domainRepo.findAll()
        val allDpias = dpiaRepo.findAll()

        fun metric(
            key: String,
            label: String,
            covered: Int,
            total: Int
        ): MaturityMetricItem {
            val pct = if (total == 0) 100 else (covered * 100 / total)
            return MaturityMetricItem(key, label, covered, total, pct)
        }

        // 1. Entity ownership coverage
        val entitiesWithOwner = allEntities.count { it.dataOwner != null }

        // 2. Process compliance coverage (has legal basis)
        val processesWithLegalBasis = allProcesses.count { it.legalBasis != null }

        // 3. Domain structure coverage (has at least one bounded context)
        val domainsWithBc = allDomains.count { !it.boundedContexts.isNullOrEmpty() }

        // Helper: does this process handle personal data?
        fun processHasPersonalData(p: org.leargon.backend.domain.Process): Boolean =
            (p.inputEntities + p.outputEntities).any { entity ->
                entity.classificationAssignments.any {
                    it.classificationKey == "personal-data" && it.valueKey == "personal-data--contains"
                }
            }

        // 4. DPIA coverage (personal data processes with a DPIA)
        val personalDataProcesses = allProcesses.filter { processHasPersonalData(it) }
        val processKeysWithDpia = allDpias.mapNotNull { it.process?.key }.toSet()
        val personalDataProcessesWithDpia = personalDataProcesses.count { it.key in processKeysWithDpia }

        // 5. Process–unit coverage (has executing unit)
        val processesWithUnit = allProcesses.count { !it.executingUnits.isNullOrEmpty() }

        // 6. Data processor documentation (personal data processes with service providers)
        val processesWithProviders = personalDataProcesses.count { it.serviceProviders.isNotEmpty() }

        // 7. Process purpose documentation (has purpose text)
        val processesWithPurpose = allProcesses.count { !it.purpose.isNullOrEmpty() }

        return MaturityMetricsResponse(
            listOf(
                metric("entityOwnership", "Entity ownership", entitiesWithOwner, allEntities.size),
                metric("processCompliance", "Process compliance", processesWithLegalBasis, allProcesses.size),
                metric("domainStructure", "Domain structure", domainsWithBc, allDomains.size),
                metric("dpiasCoverage", "DPIA coverage", personalDataProcessesWithDpia, personalDataProcesses.size),
                metric("processUnitCoverage", "Process–team assignment", processesWithUnit, allProcesses.size),
                metric("dataProcessorDocs", "Data processor documented", processesWithProviders, personalDataProcesses.size),
                metric("processPurpose", "Processing purpose", processesWithPurpose, allProcesses.size),
            )
        )
    }
}
