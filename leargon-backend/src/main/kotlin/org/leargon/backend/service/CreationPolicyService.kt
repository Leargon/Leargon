package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.BoundedContext
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository

/** Why a user may create an item at a given place — recorded for audit and shown to reviewers. */
enum class CreationBasis {
    ADMIN,
    METHODOLOGY_EDITOR,
    DOMAIN_OWNER,
    BC_OWNER,
    PARENT_OWNER,
    UNIT_OWNER,
    CAPABILITY_OWNER
}

/**
 * Where an item of [itemType] is about to be placed. Only the coordinates relevant to the type are read:
 * [parentKey] (parent of the same type), [parentKeys] (org-unit parents), [boundedContextKey] (entity /
 * process / publishing BC of an event / one side of a context relationship), [domainKey] (bounded
 * context), [owningUnitKey] (IT system, and entities/processes when DDD is disabled),
 * [otherBoundedContextKey] (the other side of a context relationship).
 */
data class CreationTarget(
    val itemType: String,
    val parentKey: String? = null,
    val parentKeys: List<String> = emptyList(),
    val boundedContextKey: String? = null,
    val domainKey: String? = null,
    val owningUnitKey: String? = null,
    val otherBoundedContextKey: String? = null
)

/** [realmType]/[realmId] name the immediate container the grant came from (null for global grants). */
data class CreationDecision(
    val allowed: Boolean,
    val basis: CreationBasis?,
    val realmType: String? = null,
    val realmId: Long? = null
)

/**
 * The single decision point for "may this user create this item here?". Every create path and every move
 * (reparent, bounded-context / owning-unit change) asks this service, and the backend-computed creation
 * flags are derived from it, so what the UI offers can never drift from what is enforced.
 *
 * Global grants: an administrator, or an EDITOR/LEAD of the item type's governing methodology, may create
 * anywhere (including top-level / unplaced). Otherwise creation is realm-based and grants CREATE only:
 *  - domain realm: the effective owner of a domain or any ancestor domain → subdomains, bounded contexts,
 *    and everything a bounded-context owner may create in its bounded contexts;
 *  - bounded-context realm: the context's effective owner → entities, processes, domain events and
 *    context relationships (own side) placed in it;
 *  - item realm: the effective owner/steward of a parent entity/process/capability → its children;
 *  - unit realm: the business owner/steward of an org unit → sub-units (non-transitive), IT systems it
 *    owns, and — only while DDD is disabled — entities/processes it owns.
 *
 * Must never be injected into [RoleService], [FieldConfigurationService] or
 * [MethodologyConfigurationService] (they are dependencies of this service).
 */
@Singleton
open class CreationPolicyService(
    private val roleService: RoleService,
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val capabilityRepository: CapabilityRepository
) {
    @Transactional
    open fun decide(
        user: User,
        target: CreationTarget
    ): CreationDecision {
        if (user.roles.contains(RoleService.ROLE_ADMIN)) return CreationDecision(true, CreationBasis.ADMIN)
        val governing = RoleService.GOVERNING_METHODOLOGY[target.itemType]
        if (governing != null && roleService.isEditorFor(user, governing)) {
            return CreationDecision(true, CreationBasis.METHODOLOGY_EDITOR)
        }
        val uid = user.id ?: return DENIED
        return when (target.itemType) {
            BUSINESS_DOMAIN -> decideSubdomain(uid, target)
            BOUNDED_CONTEXT -> decideBoundedContext(uid, target)
            BUSINESS_ENTITY -> decideEntity(uid, target)
            BUSINESS_PROCESS -> decideProcess(uid, target)
            DOMAIN_EVENT -> target.boundedContextKey?.let { bcRealm(uid, findBc(it)) } ?: DENIED
            CONTEXT_RELATIONSHIP -> decideContextRelationship(uid, target)
            ORGANISATIONAL_UNIT -> decideSubUnit(uid, target)
            CAPABILITY -> decideSubCapability(uid, target)
            IT_SYSTEM -> target.owningUnitKey?.let { unitRealm(uid, findUnit(it)) } ?: DENIED
            else -> DENIED
        }
    }

    /** [creatableChildTypes] as the API enum, for detail responses. */
    @Transactional
    open fun childTypes(
        user: User,
        containerType: String,
        key: String
    ): List<org.leargon.backend.model.CreatableItemType> =
        creatableChildTypes(user, containerType, key).map { org.leargon.backend.model.CreatableItemType.fromValue(it) }

    /** Like [decide] but throws [ForbiddenOperationException] when creation is not allowed. */
    @Transactional
    open fun require(
        user: User,
        target: CreationTarget
    ): CreationDecision {
        val decision = decide(user, target)
        if (!decision.allowed) throw ForbiddenOperationException(denialMessage(target))
        return decision
    }

    /**
     * Item types [user] may create directly inside the container [containerType]/[key] — the backend-computed
     * `creatableChildTypes` flag on detail responses. Derived from [decide], so it cannot drift from enforcement.
     */
    @Transactional
    open fun creatableChildTypes(
        user: User,
        containerType: String,
        key: String
    ): List<String> {
        val candidates =
            when (containerType) {
                BUSINESS_DOMAIN -> listOf(CreationTarget(BUSINESS_DOMAIN, parentKey = key), CreationTarget(BOUNDED_CONTEXT, domainKey = key))
                BOUNDED_CONTEXT ->
                    listOf(BUSINESS_ENTITY, BUSINESS_PROCESS, DOMAIN_EVENT, CONTEXT_RELATIONSHIP).map {
                        CreationTarget(it, boundedContextKey = key)
                    }
                BUSINESS_ENTITY -> listOf(CreationTarget(BUSINESS_ENTITY, parentKey = key))
                BUSINESS_PROCESS -> listOf(CreationTarget(BUSINESS_PROCESS, parentKey = key))
                ORGANISATIONAL_UNIT ->
                    listOf(CreationTarget(ORGANISATIONAL_UNIT, parentKeys = listOf(key)), CreationTarget(IT_SYSTEM, owningUnitKey = key))
                CAPABILITY -> listOf(CreationTarget(CAPABILITY, parentKey = key))
                else -> emptyList()
            }
        return candidates.filter { decide(user, it).allowed }.map { it.itemType }.distinct()
    }

    /** A container the user may create in, with the grant that allows it. */
    data class TargetRef(
        val key: String,
        val names: List<org.leargon.backend.domain.LocalizedText>,
        val basis: CreationBasis
    )

    data class CreationTargets(
        val unrestricted: Boolean,
        val canCreateUnplaced: Boolean,
        val parents: List<TargetRef> = emptyList(),
        val boundedContexts: List<TargetRef> = emptyList(),
        val domains: List<TargetRef> = emptyList(),
        val owningUnits: List<TargetRef> = emptyList()
    ) {
        /**
         * Whether the item can be created from its list ("New") — top level / unplaced, or into a realm
         * container (bounded context, domain, owning unit). Grants that only allow children of a parent
         * item of the same type are excluded: those are exercised via "Add child" on the parent. Subdomains
         * are the exception, since the domain realm *is* the parent-domain relationship.
         */
        fun creatableFromList(itemType: String): Boolean =
            unrestricted || canCreateUnplaced || boundedContexts.isNotEmpty() || domains.isNotEmpty() || owningUnits.isNotEmpty() ||
                (itemType == BUSINESS_DOMAIN && parents.isNotEmpty())
    }

    /**
     * Where [user] may create an item of [itemType]. Global grants (admin / methodology editor) are reported
     * as `unrestricted` with empty lists; otherwise the realm containers are enumerated with object-level
     * checks (the same predicates [decide] uses) so no per-candidate lookups are needed.
     */
    @Transactional
    open fun targets(
        user: User,
        itemType: String
    ): CreationTargets {
        val global = decide(user, CreationTarget(itemType))
        if (global.allowed && (global.basis == CreationBasis.ADMIN || global.basis == CreationBasis.METHODOLOGY_EDITOR)) {
            return CreationTargets(unrestricted = true, canCreateUnplaced = true)
        }
        val uid = user.id ?: return CreationTargets(unrestricted = false, canCreateUnplaced = false)
        val dddDisabled = DDD in methodologyConfigurationService.getDisabledMethodologies()

        fun bcTargets() =
            boundedContextRepository.findAll().mapNotNull { bc ->
                bcRealm(uid, bc).basis?.let { TargetRef(bc.key, bc.names, it) }
            }

        fun unitTargets() =
            organisationalUnitRepository.findAll().mapNotNull { u ->
                unitRealm(uid, u).basis?.let { TargetRef(u.key, u.names, it) }
            }

        fun domainTargets() =
            businessDomainRepository.findAll().mapNotNull { d ->
                if (d.realmOwners().any { it.id == uid }) TargetRef(d.key, d.names, CreationBasis.DOMAIN_OWNER) else null
            }

        return when (itemType) {
            BUSINESS_DOMAIN -> CreationTargets(false, false, parents = domainTargets())
            BOUNDED_CONTEXT -> CreationTargets(false, false, domains = domainTargets())
            BUSINESS_ENTITY ->
                CreationTargets(
                    false,
                    false,
                    parents =
                        businessEntityRepository.findAll().mapNotNull { e ->
                            when {
                                e.effectiveOwner()?.id == uid || e.effectiveSteward()?.id == uid -> TargetRef(e.key, e.names, CreationBasis.PARENT_OWNER)
                                else -> e.boundedContext?.let { bcRealm(uid, it).basis }?.let { TargetRef(e.key, e.names, it) }
                            }
                        },
                    boundedContexts = bcTargets(),
                    owningUnits = if (dddDisabled) unitTargets() else emptyList()
                )
            BUSINESS_PROCESS ->
                CreationTargets(
                    false,
                    false,
                    parents =
                        processRepository.findAll().mapNotNull { p ->
                            when {
                                p.effectiveOwner()?.id == uid || p.effectiveSteward()?.id == uid -> TargetRef(p.key, p.names, CreationBasis.PARENT_OWNER)
                                else -> p.boundedContext?.let { bcRealm(uid, it).basis }?.let { TargetRef(p.key, p.names, it) }
                            }
                        },
                    boundedContexts = bcTargets(),
                    owningUnits = if (dddDisabled) unitTargets() else emptyList()
                )
            DOMAIN_EVENT, CONTEXT_RELATIONSHIP -> CreationTargets(false, false, boundedContexts = bcTargets())
            ORGANISATIONAL_UNIT -> CreationTargets(false, false, parents = unitTargets())
            CAPABILITY ->
                CreationTargets(
                    false,
                    false,
                    parents =
                        capabilityRepository.findAll().mapNotNull { c ->
                            if (c.effectiveOwner()?.id == uid || c.effectiveSteward()?.id == uid) {
                                TargetRef(c.key, c.names, CreationBasis.CAPABILITY_OWNER)
                            } else {
                                null
                            }
                        }
                )
            IT_SYSTEM -> CreationTargets(false, false, owningUnits = unitTargets())
            else -> CreationTargets(false, false)
        }
    }

    /**
     * Re-parenting an org unit: every newly added parent needs the same rights as creating a sub-unit under
     * it (so nobody can pull a foreign unit under their own to widen their realm), and dropping all parents
     * makes the unit top-level, which needs top-level creation rights.
     */
    @Transactional
    open fun requireOrgUnitParents(
        user: User,
        unitKey: String,
        requestedParentKeys: List<String>
    ) {
        val existing = findUnit(unitKey).parents.map { it.key }.toSet()
        val added = requestedParentKeys.filter { it !in existing }
        if (added.isNotEmpty()) require(user, CreationTarget(ORGANISATIONAL_UNIT, parentKeys = added))
        if (requestedParentKeys.isEmpty() && existing.isNotEmpty()) require(user, CreationTarget(ORGANISATIONAL_UNIT))
    }

    // ── per-type rules ───────────────────────────────────────────────────────────────────────────────

    private fun decideSubdomain(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val parentKey = target.parentKey ?: return DENIED // top-level domains: DDD editor only
        val parent = businessDomainRepository.findByKey(parentKey).orElseThrow { notFound("Parent BusinessDomain", parentKey) }
        return if (parent.realmOwners().any { it.id == uid }) {
            CreationDecision(true, CreationBasis.DOMAIN_OWNER, BUSINESS_DOMAIN, parent.id)
        } else {
            DENIED
        }
    }

    private fun decideBoundedContext(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val domainKey = target.domainKey ?: return DENIED
        val domain = businessDomainRepository.findByKey(domainKey).orElseThrow { notFound("BusinessDomain", domainKey) }
        return if (domain.realmOwners().any { it.id == uid }) {
            CreationDecision(true, CreationBasis.DOMAIN_OWNER, BUSINESS_DOMAIN, domain.id)
        } else {
            DENIED
        }
    }

    private fun decideEntity(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val explicitBc = target.boundedContextKey?.let { findBc(it) }
        val parent =
            target.parentKey?.let { key ->
                businessEntityRepository.findByKey(key).orElseThrow { notFound("Parent BusinessEntity", key) }
            }
        if (parent != null) {
            val effectiveBc = explicitBc ?: parent.boundedContext
            val parentOwned = parent.effectiveOwner()?.id == uid || parent.effectiveSteward()?.id == uid
            val bcUnchanged = explicitBc == null || explicitBc.id == parent.boundedContext?.id
            if (parentOwned && (bcUnchanged || bcRealm(uid, explicitBc!!).allowed)) {
                return CreationDecision(true, CreationBasis.PARENT_OWNER, BUSINESS_ENTITY, parent.id)
            }
            return effectiveBc?.let { bcRealm(uid, it) } ?: DENIED
        }
        if (explicitBc != null) return bcRealm(uid, explicitBc)
        return unplacedUnitFallback(uid, target)
    }

    private fun decideProcess(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val explicitBc = target.boundedContextKey?.let { findBc(it) }
        val parent =
            target.parentKey?.let { key ->
                processRepository.findByKey(key).orElseThrow { notFound("Parent process", key) }
            }
        if (parent != null) {
            val effectiveBc = explicitBc ?: parent.boundedContext
            val parentOwned = parent.effectiveOwner()?.id == uid || parent.effectiveSteward()?.id == uid
            val bcUnchanged = explicitBc == null || explicitBc.id == parent.boundedContext?.id
            if (parentOwned && (bcUnchanged || bcRealm(uid, explicitBc!!).allowed)) {
                return CreationDecision(true, CreationBasis.PARENT_OWNER, BUSINESS_PROCESS, parent.id)
            }
            return effectiveBc?.let { bcRealm(uid, it) } ?: DENIED
        }
        if (explicitBc != null) return bcRealm(uid, explicitBc)
        return unplacedUnitFallback(uid, target)
    }

    /** Unplaced entities/processes may be created by the owning unit's owner only while DDD is disabled. */
    private fun unplacedUnitFallback(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val unitKey = target.owningUnitKey ?: return DENIED
        if (DDD !in methodologyConfigurationService.getDisabledMethodologies()) return DENIED
        return unitRealm(uid, findUnit(unitKey))
    }

    private fun decideContextRelationship(
        uid: Long,
        target: CreationTarget
    ): CreationDecision =
        listOfNotNull(target.boundedContextKey, target.otherBoundedContextKey)
            .map { bcRealm(uid, findBc(it)) }
            .firstOrNull { it.allowed } ?: DENIED

    /** A sub-unit needs rights on EVERY requested parent — adding a parent places the unit into it. */
    private fun decideSubUnit(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        if (target.parentKeys.isEmpty()) return DENIED // top-level units: TEAM_TOPOLOGIES editor only
        val parents = target.parentKeys.map { findUnit(it) }
        return if (parents.all { unitRealm(uid, it).allowed }) {
            CreationDecision(true, CreationBasis.UNIT_OWNER, ORGANISATIONAL_UNIT, parents.first().id)
        } else {
            DENIED
        }
    }

    private fun decideSubCapability(
        uid: Long,
        target: CreationTarget
    ): CreationDecision {
        val parentKey = target.parentKey ?: return DENIED // L1 capabilities: BCM editor only
        val parent = capabilityRepository.findByKey(parentKey).orElseThrow { notFound("Parent capability", parentKey) }
        return if (parent.effectiveOwner()?.id == uid || parent.effectiveSteward()?.id == uid) {
            CreationDecision(true, CreationBasis.CAPABILITY_OWNER, CAPABILITY, parent.id)
        } else {
            DENIED
        }
    }

    // ── realm checks ─────────────────────────────────────────────────────────────────────────────────

    private fun bcRealm(
        uid: Long,
        bc: BoundedContext
    ): CreationDecision =
        when {
            bc.effectiveOwner()?.id == uid -> CreationDecision(true, CreationBasis.BC_OWNER, BOUNDED_CONTEXT, bc.id)
            bc.domain?.realmOwners()?.any { it.id == uid } == true -> CreationDecision(true, CreationBasis.DOMAIN_OWNER, BOUNDED_CONTEXT, bc.id)
            else -> DENIED
        }

    private fun unitRealm(
        uid: Long,
        unit: OrganisationalUnit
    ): CreationDecision =
        if (unit.businessOwner?.id == uid || unit.businessSteward?.id == uid) {
            CreationDecision(true, CreationBasis.UNIT_OWNER, ORGANISATIONAL_UNIT, unit.id)
        } else {
            DENIED
        }

    private fun findBc(key: String): BoundedContext = boundedContextRepository.findByKey(key).orElseThrow { notFound("BoundedContext", key) }

    private fun findUnit(key: String): OrganisationalUnit =
        organisationalUnitRepository.findByKey(key).orElseThrow { notFound("OrganisationalUnit", key) }

    private fun notFound(
        what: String,
        key: String
    ) = ResourceNotFoundException("$what not found: $key")

    private fun denialMessage(target: CreationTarget): String {
        val governing = RoleService.GOVERNING_METHODOLOGY[target.itemType]
        return "Creating this item here requires an administrator, a $governing editor/lead, " +
            "or ownership of the place it is created in (its domain, bounded context, parent item or unit)"
    }

    companion object {
        const val BUSINESS_DOMAIN = "BUSINESS_DOMAIN"
        const val BOUNDED_CONTEXT = "BOUNDED_CONTEXT"
        const val BUSINESS_ENTITY = "BUSINESS_ENTITY"
        const val BUSINESS_PROCESS = "BUSINESS_PROCESS"
        const val DOMAIN_EVENT = "DOMAIN_EVENT"
        const val CONTEXT_RELATIONSHIP = "CONTEXT_RELATIONSHIP"
        const val ORGANISATIONAL_UNIT = "ORGANISATIONAL_UNIT"
        const val CAPABILITY = "CAPABILITY"
        const val IT_SYSTEM = "IT_SYSTEM"
        const val SERVICE_PROVIDER = "SERVICE_PROVIDER"
        private const val DDD = "DDD"

        /** Every item type governed by the creation policy, in display order. */
        val ALL_ITEM_TYPES =
            listOf(
                BUSINESS_DOMAIN,
                BOUNDED_CONTEXT,
                BUSINESS_ENTITY,
                BUSINESS_PROCESS,
                DOMAIN_EVENT,
                CONTEXT_RELATIONSHIP,
                ORGANISATIONAL_UNIT,
                CAPABILITY,
                IT_SYSTEM,
                SERVICE_PROVIDER
            )

        private val DENIED = CreationDecision(false, null)
    }
}
