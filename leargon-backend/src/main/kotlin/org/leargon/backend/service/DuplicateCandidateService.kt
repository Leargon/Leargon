package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.exception.DuplicateCandidatesException
import org.leargon.backend.mapper.LocalizedTextMapper
import org.leargon.backend.model.CreatableItemType
import org.leargon.backend.model.DuplicateCandidate
import org.leargon.backend.model.DuplicateCandidateMatchType
import org.leargon.backend.model.DuplicateCandidateScope
import org.leargon.backend.model.DuplicateCandidateSuggestion
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ItSystemRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ServiceProviderRepository
import org.leargon.backend.util.NameMatching

/**
 * Finds existing items whose names match a proposed new item, and blocks creation of a likely duplicate
 * unless the creator justifies it.
 *
 * A match only *blocks* inside the same container — the same bounded context (or, unplaced, the same
 * parent) for entities and processes, sibling domains / units / capabilities, the same domain for bounded
 * contexts, and the whole type for IT systems and service providers (plus exact capability names). Matches
 * elsewhere are informational: the same word in another bounded context is often a legitimately different
 * concept, for which a translation link (entities) or reuse (processes) is suggested instead.
 */
@Singleton
open class DuplicateCandidateService(
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val capabilityRepository: CapabilityRepository,
    private val itSystemRepository: ItSystemRepository,
    private val serviceProviderRepository: ServiceProviderRepository
) {
    private data class Existing(
        val key: String,
        val names: List<LocalizedText>,
        val sameContainer: Boolean,
        val containerKey: String? = null,
        val containerNames: List<LocalizedText> = emptyList(),
        val exactAlwaysBlocks: Boolean = false,
        val elsewhereSuggestion: DuplicateCandidateSuggestion = DuplicateCandidateSuggestion.NONE
    )

    /** Candidates for a new item of [target]'s type named [proposedNames] (any locale), strongest first. */
    @Transactional
    open fun candidates(
        target: CreationTarget,
        proposedNames: List<String>
    ): List<DuplicateCandidate> {
        val names = proposedNames.filter { it.isNotBlank() }
        if (names.isEmpty()) return emptyList()
        return existingOf(target)
            .mapNotNull { existing ->
                val match = NameMatching.bestMatch(names, existing.names.map { it.text }) ?: return@mapNotNull null
                val blocking = existing.sameContainer || (existing.exactAlwaysBlocks && match.type == NameMatching.MatchType.EXACT)
                DuplicateCandidate(
                    CreatableItemType.fromValue(target.itemType),
                    existing.key,
                    LocalizedTextMapper.toModel(existing.names),
                    DuplicateCandidateMatchType.fromValue(match.type.name),
                    match.score,
                    if (existing.sameContainer) DuplicateCandidateScope.SAME_CONTAINER else DuplicateCandidateScope.ELSEWHERE,
                    blocking,
                    if (blocking) DuplicateCandidateSuggestion.NONE else existing.elsewhereSuggestion
                ).containerKey(existing.containerKey)
                    .containerNames(LocalizedTextMapper.toModel(existing.containerNames))
            }.sortedWith(compareByDescending<DuplicateCandidate> { it.blocking }.thenByDescending { it.score })
    }

    /**
     * Throws [DuplicateCandidatesException] (409) when a blocking candidate exists and the request does not
     * both justify the new item and acknowledge every blocking candidate — a stale acknowledgement (made
     * before another duplicate appeared) is therefore refused too.
     */
    @Transactional
    open fun requireNoUnjustifiedDuplicates(
        target: CreationTarget,
        proposedNames: List<String>,
        justification: List<org.leargon.backend.model.LocalizedText>?,
        acknowledgedKeys: List<String>?
    ) {
        val all = candidates(target, proposedNames)
        val blocking = all.filter { it.blocking }
        if (blocking.isEmpty()) return
        val justified = justification.orEmpty().any { it.text.trim().length >= MIN_JUSTIFICATION_LENGTH }
        val acknowledged = acknowledgedKeys.orEmpty().toSet().containsAll(blocking.map { it.key })
        if (!justified || !acknowledged) throw DuplicateCandidatesException(all)
    }

    private fun existingOf(target: CreationTarget): List<Existing> =
        when (target.itemType) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                val bcKey =
                    target.boundedContextKey
                        ?: target.parentKey?.let {
                            businessEntityRepository
                                .findByKey(it)
                                .orElse(null)
                                ?.boundedContext
                                ?.key
                        }
                businessEntityRepository.findAll().map { e ->
                    val same =
                        if (bcKey !=
                            null
                        ) {
                            e.boundedContext?.key == bcKey
                        } else {
                            e.boundedContext == null && e.parent?.key == target.parentKey
                        }
                    Existing(
                        e.key, e.names, same, e.boundedContext?.key, e.boundedContext?.names.orEmpty(),
                        elsewhereSuggestion =
                            if (bcKey != null &&
                                e.boundedContext != null
                            ) {
                                DuplicateCandidateSuggestion.TRANSLATION_LINK
                            } else {
                                DuplicateCandidateSuggestion.NONE
                            }
                    )
                }
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                val bcKey =
                    target.boundedContextKey
                        ?: target.parentKey?.let {
                            processRepository
                                .findByKey(it)
                                .orElse(null)
                                ?.boundedContext
                                ?.key
                        }
                processRepository.findAll().map { p ->
                    val same =
                        if (bcKey !=
                            null
                        ) {
                            p.boundedContext?.key == bcKey
                        } else {
                            p.boundedContext == null && p.parent?.key == target.parentKey
                        }
                    Existing(
                        p.key, p.names, same, p.boundedContext?.key, p.boundedContext?.names.orEmpty(),
                        elsewhereSuggestion = DuplicateCandidateSuggestion.REUSE_OR_CALL
                    )
                }
            }
            CreationPolicyService.BUSINESS_DOMAIN -> {
                businessDomainRepository.findAll().map { d ->
                    Existing(d.key, d.names, d.parent?.key == target.parentKey, d.parent?.key, d.parent?.names.orEmpty())
                }
            }
            CreationPolicyService.BOUNDED_CONTEXT -> {
                boundedContextRepository.findAll().map { bc ->
                    Existing(bc.key, bc.names, bc.domain?.key == target.domainKey, bc.domain?.key, bc.domain?.names.orEmpty())
                }
            }
            CreationPolicyService.ORGANISATIONAL_UNIT -> {
                organisationalUnitRepository.findAll().map { u ->
                    val same = if (target.parentKeys.isEmpty()) u.parents.isEmpty() else u.parents.any { it.key in target.parentKeys }
                    Existing(u.key, u.names, same)
                }
            }
            CreationPolicyService.CAPABILITY -> {
                capabilityRepository.findAll().map { c ->
                    Existing(
                        c.key,
                        c.names,
                        c.parent?.key == target.parentKey,
                        c.parent?.key,
                        c.parent?.names.orEmpty(),
                        exactAlwaysBlocks = true
                    )
                }
            }
            CreationPolicyService.IT_SYSTEM -> {
                itSystemRepository.findAll().map { Existing(it.key, it.names, true) }
            }
            CreationPolicyService.SERVICE_PROVIDER -> {
                serviceProviderRepository.findAll().map { Existing(it.key, it.names, true) }
            }
            else -> {
                emptyList()
            }
        }

    companion object {
        /** A justification must say something — a few characters are not an explanation. */
        const val MIN_JUSTIFICATION_LENGTH = 10
    }
}
