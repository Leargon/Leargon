package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.model.BottleneckTeamItem
import org.leargon.backend.model.CognitiveLoadItem
import org.leargon.backend.model.ConwaysLawAlignment
import org.leargon.backend.model.ConwaysLawCell
import org.leargon.backend.model.ConwaysLawMisalignmentItem
import org.leargon.backend.model.OrgUnitProcessLoadItem
import org.leargon.backend.model.SplitDomainItem
import org.leargon.backend.model.TeamInsightsResponse
import org.leargon.backend.model.TeamInteractionAntiPatternItem
import org.leargon.backend.model.TeamInteractionMode
import org.leargon.backend.model.TeamTopologyEdge
import org.leargon.backend.model.TeamTopologyGraph
import org.leargon.backend.model.TeamTopologyNode
import org.leargon.backend.model.TeamTopologyType
import org.leargon.backend.model.UserOwnershipWorkloadItem
import org.leargon.backend.model.WronglyPlacedTeamItem
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.TeamInteractionRepository

@Singleton
open class AnalyticsService(
    private val processRepository: ProcessRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val teamInteractionRepository: TeamInteractionRepository,
    private val methodologyConfigurationService: MethodologyConfigurationService,
) {
    private val cognitiveLoadThreshold = 7.0
    @Transactional
    open fun getTeamInsights(locale: String = "en"): TeamInsightsResponse {
        // Capture for AOP proxy safety
        val procRepo = this.processRepository
        val entityRepo = this.businessEntityRepository

        val processes = procRepo.findAll()
        val entities = entityRepo.findAll()

        // Helper to get name from LocalizedText list
        fun nameOf(
            names: List<LocalizedText>,
            fallback: String
        ): String = names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: fallback

        // 1. User ownership workload
        val entityCountByOwner =
            entities
                .mapNotNull { it.effectiveOwner() }
                .groupBy { it.id }
                .mapValues { it.value.size }
        val processCountByOwner =
            processes
                .mapNotNull { it.effectiveOwner() }
                .groupBy { it.id }
                .mapValues { it.value.size }
        val allOwnerIds = (entityCountByOwner.keys + processCountByOwner.keys).toSet()
        // Build user map from processes and entities
        val userById =
            (
                processes.mapNotNull { it.effectiveOwner() } +
                    entities.mapNotNull { it.effectiveOwner() }
            ).associateBy { it.id }

        val userOwnershipWorkload =
            allOwnerIds
                .mapNotNull { uid ->
                    val user = userById[uid] ?: return@mapNotNull null
                    val ec = entityCountByOwner[uid] ?: 0
                    val pc = processCountByOwner[uid] ?: 0
                    UserOwnershipWorkloadItem(
                        uid!!,
                        user.username,
                        "${user.firstName ?: ""} ${user.lastName ?: ""}".trim(),
                        ec,
                        pc,
                        ec + pc
                    )
                }.sortedByDescending { it.totalCount }

        // 2. Org unit process load
        val processesByOrgUnit = mutableMapOf<String, MutableList<org.leargon.backend.domain.Process>>()
        for (p in processes) {
            for (unit in p.executingUnits) {
                processesByOrgUnit.getOrPut(unit.key) { mutableListOf() }.add(p)
            }
        }
        val orgUnitByKey = processes.flatMap { it.executingUnits }.associateBy { it.key }

        val orgUnitProcessLoad =
            processesByOrgUnit
                .map { (key, procs) ->
                    val unit = orgUnitByKey[key]
                    val unitName = unit?.let { nameOf(it.names, key) } ?: key
                    OrgUnitProcessLoadItem(key, unitName, procs.size)
                }.sortedByDescending { it.processCount }

        // 3. Bottleneck teams (>= 3 distinct domains)
        val bottleneckTeams =
            processesByOrgUnit
                .mapNotNull { (key, procs) ->
                    val domains = procs.mapNotNull { it.boundedContext?.key }.toSet()
                    if (domains.size < 3) return@mapNotNull null
                    val unit = orgUnitByKey[key]
                    val unitName = unit?.let { nameOf(it.names, key) } ?: key
                    BottleneckTeamItem(key, unitName, procs.size, domains.size, domains.toList().sorted())
                }.sortedByDescending { it.distinctDomainCount }

        // 4. Wrongly placed teams (dominant domain share < 60%, >= 2 processes)
        val wronglyPlacedTeams =
            processesByOrgUnit
                .mapNotNull { (key, procs) ->
                    if (procs.size < 2) return@mapNotNull null
                    val withDomain = procs.filter { it.boundedContext != null }
                    if (withDomain.isEmpty()) return@mapNotNull null
                    val domainFreq = withDomain.groupBy { it.boundedContext!!.key }.mapValues { it.value.size }
                    val dominantEntry = domainFreq.maxByOrNull { it.value } ?: return@mapNotNull null
                    val share = dominantEntry.value.toDouble() / withDomain.size
                    if (share >= 0.6) return@mapNotNull null
                    val unit = orgUnitByKey[key]
                    val unitName = unit?.let { nameOf(it.names, key) } ?: key
                    val domainName =
                        withDomain
                            .find { it.boundedContext?.key == dominantEntry.key }
                            ?.boundedContext
                            ?.let { nameOf(it.names, it.key) }
                    WronglyPlacedTeamItem(key, unitName, procs.size, domainFreq.size, share)
                        .dominantDomainKey(dominantEntry.key)
                        .dominantDomainName(domainName)
                }.sortedBy { it.dominantDomainShare }

        // 5. Split domains (>= 3 distinct org units)
        val domainProcesses = processes.filter { it.boundedContext != null }
        val processesByDomain = domainProcesses.groupBy { it.boundedContext!!.key }
        val splitDomains =
            processesByDomain
                .mapNotNull { (domainKey, procs) ->
                    val orgUnits = procs.flatMap { it.executingUnits.map { u -> u.key } }.toSet()
                    if (orgUnits.size < 3) return@mapNotNull null
                    val domain = procs.first().boundedContext!!
                    val domainName = nameOf(domain.names, domainKey)
                    SplitDomainItem(domainKey, domainName, procs.size, orgUnits.size, orgUnits.toList().sorted())
                }.sortedByDescending { it.distinctOrgUnitCount }

        // 6. Conway's Law alignment matrix
        val allDomainKeys = domainProcesses.mapNotNull { it.boundedContext?.key }.toSet().sorted()
        val allOrgUnitKeysConway = processesByOrgUnit.keys.sorted()
        val domainNameMap =
            domainProcesses
                .mapNotNull { it.boundedContext }
                .distinctBy { it.key }
                .associate { it.key to nameOf(it.names, it.key) }
        val orgUnitNameMap =
            orgUnitByKey.entries
                .filter { allOrgUnitKeysConway.contains(it.key) }
                .associate { it.key to nameOf(it.value.names, it.key) }

        val cellMap = mutableMapOf<Pair<String, String>, Int>()
        for (p in domainProcesses) {
            val dk = p.boundedContext!!.key
            for (u in p.executingUnits) {
                val pair = Pair(dk, u.key)
                cellMap[pair] = (cellMap[pair] ?: 0) + 1
            }
        }
        val cells =
            cellMap.map { (pair, count) ->
                ConwaysLawCell(pair.first, pair.second, count)
            }
        val conwaysLawAlignment =
            ConwaysLawAlignment(
                allDomainKeys,
                allOrgUnitKeysConway,
                domainNameMap,
                orgUnitNameMap,
                cells
            )

        // 7. Conway's Law misalignments
        // Pre-load all org units with parents eagerly to avoid lazy-loading issues
        val allOrgUnits = this.organisationalUnitRepository.findAll()
        val allOrgUnitByKey = allOrgUnits.associateBy { it.key }

        // Pre-load all bounded contexts and build a map: orgUnitKey -> BC (null if no owning BC)
        val allBoundedContexts = this.boundedContextRepository.findAll()
        val bcByOwningUnitKey =
            allBoundedContexts
                .filter { it.owningUnit != null }
                .associateBy { it.owningUnit!!.key }

        val conwaysLawMisalignments = mutableListOf<ConwaysLawMisalignmentItem>()

        fun findOwningBoundedContext(
            unitKey: String,
            visited: MutableSet<String> = mutableSetOf()
        ): BoundedContext? {
            if (visited.contains(unitKey)) return null
            visited.add(unitKey)

            val direct = bcByOwningUnitKey[unitKey]
            if (direct != null) return direct

            val unit = allOrgUnitByKey[unitKey] ?: return null
            for (parent in unit.parents) {
                val parentKey = parent.key
                val parentBc = findOwningBoundedContext(parentKey, visited)
                if (parentBc != null) return parentBc
            }
            return null
        }

        for (process in processes) {
            val processBc = process.boundedContext ?: continue
            for (unit in process.executingUnits) {
                val teamBc = findOwningBoundedContext(unit.key) ?: continue
                if (teamBc.id != processBc.id) {
                    conwaysLawMisalignments.add(
                        ConwaysLawMisalignmentItem(
                            process.key,
                            nameOf(process.names, process.key),
                            processBc.key,
                            nameOf(processBc.names, processBc.key),
                            unit.key,
                            nameOf(unit.names, unit.key),
                            teamBc.key,
                            nameOf(teamBc.names, teamBc.key)
                        )
                    )
                }
            }
        }

        // 8. Team Topologies analytics (cognitive load, interaction anti-patterns, topology graph).
        // Only computed when the TEAM_TOPOLOGIES methodology is enabled.
        val teamTopologiesEnabled = "TEAM_TOPOLOGIES" !in methodologyConfigurationService.getDisabledMethodologies()

        if (teamTopologiesEnabled) {
            val processByKey = processes.associateBy { it.key }
            fun rootKey(start: org.leargon.backend.domain.Process): String {
                var cur = start
                var guard = 0
                while (cur.parent != null && guard < 50) {
                    cur = processByKey[cur.parent!!.key] ?: cur.parent!!
                    guard++
                }
                return cur.key
            }

            // Cognitive load per team = # owned bounded contexts + # distinct capabilities executed + # distinct value streams.
            val cognitiveLoad =
                allOrgUnits.map { unit ->
                    val procs = processesByOrgUnit[unit.key] ?: emptyList()
                    val bcCount = allBoundedContexts.count { it.owningUnit?.key == unit.key }
                    val capCount = procs.flatMap { p -> p.capabilities.map { it.key } }.toSet().size
                    val vsCount = procs.map { rootKey(it) }.toSet().size
                    val score = (bcCount + capCount + vsCount).toDouble()
                    CognitiveLoadItem(
                        unit.key,
                        nameOf(unit.names, unit.key),
                        score,
                        bcCount,
                        capCount,
                        vsCount,
                        cognitiveLoadThreshold,
                        score > cognitiveLoadThreshold
                    )
                }.sortedByDescending { it.score }
            val scoreByUnitKey = cognitiveLoad.associate { it.orgUnitKey to it.score }

            val interactions = this.teamInteractionRepository.findAll()

            fun isStreamAligned(unit: org.leargon.backend.domain.OrganisationalUnit?): Boolean =
                unit?.teamTopologyType == "STREAM_ALIGNED"

            fun isAntiPattern(i: org.leargon.backend.domain.TeamInteraction): Boolean =
                isStreamAligned(i.sourceUnit) &&
                    isStreamAligned(i.targetUnit) &&
                    i.mode == "COLLABORATION" &&
                    i.duration == "ONGOING"

            val teamInteractionAntiPatterns =
                interactions.filter { isAntiPattern(it) }.map { i ->
                    val s = i.sourceUnit!!
                    val t = i.targetUnit!!
                    TeamInteractionAntiPatternItem(
                        i.id!!,
                        s.key,
                        nameOf(s.names, s.key),
                        t.key,
                        nameOf(t.names, t.key),
                        "Two stream-aligned teams in an ongoing collaboration — expected to converge to X-as-a-Service"
                    )
                }

            // Topology graph: nodes = teams with a type or participating in an interaction; edges = interactions.
            val interactionUnitKeys = interactions.flatMap { listOf(it.sourceUnit?.key, it.targetUnit?.key) }.filterNotNull().toSet()
            val nodes =
                allOrgUnits
                    .filter { it.teamTopologyType != null || it.key in interactionUnitKeys }
                    .map { unit ->
                        TeamTopologyNode(unit.key, nameOf(unit.names, unit.key))
                            .teamTopologyType(unit.teamTopologyType?.let { TeamTopologyType.fromValue(it) })
                            .cognitiveLoadScore(scoreByUnitKey[unit.key])
                    }
            val edges =
                interactions.map { i ->
                    TeamTopologyEdge(i.id!!, i.sourceUnit!!.key, i.targetUnit!!.key, TeamInteractionMode.fromValue(i.mode))
                        .healthScore(i.healthScore)
                        .antiPattern(isAntiPattern(i))
                }

            val response =
                TeamInsightsResponse(
                    userOwnershipWorkload,
                    orgUnitProcessLoad,
                    bottleneckTeams,
                    wronglyPlacedTeams,
                    splitDomains,
                    conwaysLawAlignment
                )
            response.conwaysLawMisalignments = conwaysLawMisalignments
            response.cognitiveLoad = cognitiveLoad
            response.teamInteractionAntiPatterns = teamInteractionAntiPatterns
            response.teamTopologyGraph = TeamTopologyGraph(nodes, edges)
            return response
        }

        val response =
            TeamInsightsResponse(
                userOwnershipWorkload,
                orgUnitProcessLoad,
                bottleneckTeams,
                wronglyPlacedTeams,
                splitDomains,
                conwaysLawAlignment
            )
        response.conwaysLawMisalignments = conwaysLawMisalignments
        return response
    }
}
