package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.model.BottleneckTeamItem
import org.leargon.backend.model.ConwaysLawAlignment
import org.leargon.backend.model.ConwaysLawCell
import org.leargon.backend.model.OrgUnitProcessLoadItem
import org.leargon.backend.model.SplitDomainItem
import org.leargon.backend.model.TeamInsightsResponse
import org.leargon.backend.model.UserOwnershipWorkloadItem
import org.leargon.backend.model.WronglyPlacedTeamItem
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.ProcessRepository

@Singleton
open class AnalyticsService(
    private val processRepository: ProcessRepository,
    private val businessEntityRepository: BusinessEntityRepository,
) {

    fun getTeamInsights(locale: String = "en"): TeamInsightsResponse {
        // Capture for AOP proxy safety
        val procRepo = this.processRepository
        val entityRepo = this.businessEntityRepository

        val processes = procRepo.findAll()
        val entities = entityRepo.findAll()

        // Helper to get name from LocalizedText list
        fun nameOf(names: List<LocalizedText>, fallback: String): String =
            names.find { it.locale == locale }?.text ?: names.firstOrNull()?.text ?: fallback

        // 1. User ownership workload
        val entityCountByOwner = entities
            .filter { it.dataOwner != null }
            .groupBy { it.dataOwner!!.id }
            .mapValues { it.value.size }
        val processCountByOwner = processes
            .filter { it.processOwner != null }
            .groupBy { it.processOwner!!.id }
            .mapValues { it.value.size }
        val allOwnerIds = (entityCountByOwner.keys + processCountByOwner.keys).toSet()
        // Build user map from processes and entities
        val userById = (
            processes.mapNotNull { it.processOwner } +
            entities.mapNotNull { it.dataOwner }
        ).associateBy { it.id }

        val userOwnershipWorkload = allOwnerIds.mapNotNull { uid ->
            val user = userById[uid] ?: return@mapNotNull null
            val ec = entityCountByOwner[uid] ?: 0
            val pc = processCountByOwner[uid] ?: 0
            UserOwnershipWorkloadItem(uid!!, user.username, "${user.firstName ?: ""} ${user.lastName ?: ""}".trim(), ec, pc, ec + pc)
        }.sortedByDescending { it.totalCount }

        // 2. Org unit process load
        val processesByOrgUnit = mutableMapOf<String, MutableList<org.leargon.backend.domain.Process>>()
        for (p in processes) {
            for (unit in p.executingUnits) {
                processesByOrgUnit.getOrPut(unit.key) { mutableListOf() }.add(p)
            }
        }
        val orgUnitByKey = processes.flatMap { it.executingUnits }.associateBy { it.key }

        val orgUnitProcessLoad = processesByOrgUnit.map { (key, procs) ->
            val unit = orgUnitByKey[key]
            val unitName = unit?.let { nameOf(it.names, key) } ?: key
            OrgUnitProcessLoadItem(key, unitName, procs.size)
        }.sortedByDescending { it.processCount }

        // 3. Bottleneck teams (>= 3 distinct domains)
        val bottleneckTeams = processesByOrgUnit.mapNotNull { (key, procs) ->
            val domains = procs.mapNotNull { it.boundedContext?.key }.toSet()
            if (domains.size < 3) return@mapNotNull null
            val unit = orgUnitByKey[key]
            val unitName = unit?.let { nameOf(it.names, key) } ?: key
            BottleneckTeamItem(key, unitName, procs.size, domains.size, domains.toList().sorted())
        }.sortedByDescending { it.distinctDomainCount }

        // 4. Wrongly placed teams (dominant domain share < 60%, >= 2 processes)
        val wronglyPlacedTeams = processesByOrgUnit.mapNotNull { (key, procs) ->
            if (procs.size < 2) return@mapNotNull null
            val withDomain = procs.filter { it.boundedContext != null }
            if (withDomain.isEmpty()) return@mapNotNull null
            val domainFreq = withDomain.groupBy { it.boundedContext!!.key }.mapValues { it.value.size }
            val dominantEntry = domainFreq.maxByOrNull { it.value } ?: return@mapNotNull null
            val share = dominantEntry.value.toDouble() / withDomain.size
            if (share >= 0.6) return@mapNotNull null
            val unit = orgUnitByKey[key]
            val unitName = unit?.let { nameOf(it.names, key) } ?: key
            val domainName = withDomain.find { it.boundedContext?.key == dominantEntry.key }
                ?.boundedContext?.let { nameOf(it.names, it.key) }
            WronglyPlacedTeamItem(key, unitName, procs.size, domainFreq.size, share)
                .dominantDomainKey(dominantEntry.key)
                .dominantDomainName(domainName)
        }.sortedBy { it.dominantDomainShare }

        // 5. Split domains (>= 3 distinct org units)
        val domainProcesses = processes.filter { it.boundedContext != null }
        val processesByDomain = domainProcesses.groupBy { it.boundedContext!!.key }
        val splitDomains = processesByDomain.mapNotNull { (domainKey, procs) ->
            val orgUnits = procs.flatMap { it.executingUnits.map { u -> u.key } }.toSet()
            if (orgUnits.size < 3) return@mapNotNull null
            val domain = procs.first().boundedContext!!
            val domainName = nameOf(domain.names, domainKey)
            SplitDomainItem(domainKey, domainName, procs.size, orgUnits.size, orgUnits.toList().sorted())
        }.sortedByDescending { it.distinctOrgUnitCount }

        // 6. Conway's Law alignment matrix
        val allDomainKeys = domainProcesses.mapNotNull { it.boundedContext?.key }.toSet().sorted()
        val allOrgUnitKeysConway = processesByOrgUnit.keys.sorted()
        val domainNameMap = domainProcesses
            .mapNotNull { it.boundedContext }
            .distinctBy { it.key }
            .associate { it.key to nameOf(it.names, it.key) }
        val orgUnitNameMap = orgUnitByKey.entries
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
        val cells = cellMap.map { (pair, count) ->
            ConwaysLawCell(pair.first, pair.second, count)
        }
        val conwaysLawAlignment = ConwaysLawAlignment(
            allDomainKeys,
            allOrgUnitKeysConway,
            domainNameMap,
            orgUnitNameMap,
            cells
        )

        return TeamInsightsResponse(
            userOwnershipWorkload,
            orgUnitProcessLoad,
            bottleneckTeams,
            wronglyPlacedTeams,
            splitDomains,
            conwaysLawAlignment
        )
    }
}
