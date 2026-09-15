package org.leargon.backend.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.ItemCreationRecord
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.CreationReviewInfo
import org.leargon.backend.model.TaskItemResourceType
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.CapabilityRepository
import org.leargon.backend.repository.ItemCreationRecordRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.UserRepository
import java.time.Instant
import java.time.ZoneOffset
import org.leargon.backend.model.CreationBasis as CreationBasisDto

/**
 * Records how catalogue items are created and resolves the "review new item" to-do: the owner of the
 * container an item was placed in reviews items created there by someone else. The container's owner is
 * resolved live, so the review follows a change of ownership.
 */
@Singleton
open class CreationRecordService(
    private val itemCreationRecordRepository: ItemCreationRecordRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val boundedContextRepository: BoundedContextRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val capabilityRepository: CapabilityRepository,
    private val userRepository: UserRepository
) {
    private val objectMapper = ObjectMapper()

    /** The catalogue item a record points at, as the to-do list needs it. */
    data class ResolvedItem(
        val entityType: String,
        val resourceType: TaskItemResourceType,
        val key: String,
        val names: List<LocalizedText>,
        val updatedAt: Instant?
    )

    private data class Placement(
        val id: Long,
        val realmType: String?,
        val realmId: Long?
    )

    /**
     * Stores the creation of item [key] of [itemType]. The container is derived from the saved item —
     * its parent, else its bounded context / domain, else its owning unit — so every create path records
     * the same thing.
     */
    @Transactional
    open fun recordCreation(
        itemType: String,
        key: String,
        creator: User,
        basis: CreationBasis?,
        justification: List<org.leargon.backend.model.LocalizedText>?,
        acknowledgedKeys: List<String>?
    ) {
        val placement = locate(itemType, key) ?: return
        val mapper = objectMapper
        itemCreationRecordRepository.save(
            ItemCreationRecord().apply {
                resourceType = itemType
                resourceId = placement.id
                realmType = placement.realmType
                realmId = placement.realmId
                createdById = creator.id
                this.basis = basis?.name
                duplicateJustification =
                    justification
                        ?.filter { it.text.isNotBlank() }
                        ?.takeIf { it.isNotEmpty() }
                        ?.let { list -> mapper.writeValueAsString(list.map { mapOf("locale" to it.locale, "text" to it.text.trim()) }) }
                acknowledgedCandidateKeys = acknowledgedKeys?.takeIf { it.isNotEmpty() }?.joinToString("\n")
            }
        )
    }

    @Transactional
    open fun openReviews(): List<ItemCreationRecord> = itemCreationRecordRepository.findByReviewedAtIsNull()

    /** The current effective owner of the container the item was created in (null when there is none). */
    @Transactional
    open fun realmOwnerId(record: ItemCreationRecord): Long? {
        val id = record.realmId ?: return null
        return when (record.realmType) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                businessEntityRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                processRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            CreationPolicyService.BOUNDED_CONTEXT -> {
                boundedContextRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            CreationPolicyService.BUSINESS_DOMAIN -> {
                businessDomainRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            CreationPolicyService.ORGANISATIONAL_UNIT -> {
                organisationalUnitRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            CreationPolicyService.CAPABILITY -> {
                capabilityRepository
                    .findById(id)
                    .orElse(null)
                    ?.effectiveOwner()
                    ?.id
            }
            else -> {
                null
            }
        }
    }

    /** The item the record points at, or null when it has been deleted since. */
    @Transactional
    open fun resolveItem(record: ItemCreationRecord): ResolvedItem? {
        val id = record.resourceId
        return when (record.resourceType) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                businessEntityRepository.findById(id).orElse(null)?.let {
                    ResolvedItem(record.resourceType, TaskItemResourceType.ENTITY, it.key, it.names, it.updatedAt)
                }
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                processRepository.findById(id).orElse(null)?.let {
                    ResolvedItem(record.resourceType, TaskItemResourceType.PROCESS, it.key, it.names, it.updatedAt)
                }
            }
            CreationPolicyService.BUSINESS_DOMAIN -> {
                businessDomainRepository.findById(id).orElse(null)?.let {
                    ResolvedItem(record.resourceType, TaskItemResourceType.DOMAIN, it.key, it.names, it.updatedAt)
                }
            }
            // Bounded contexts are shown on their domain's page.
            CreationPolicyService.BOUNDED_CONTEXT -> {
                boundedContextRepository.findById(id).orElse(null)?.let { bc ->
                    bc.domain?.let { ResolvedItem(record.resourceType, TaskItemResourceType.DOMAIN, it.key, bc.names, bc.updatedAt) }
                }
            }
            CreationPolicyService.ORGANISATIONAL_UNIT -> {
                organisationalUnitRepository.findById(id).orElse(null)?.let {
                    ResolvedItem(record.resourceType, TaskItemResourceType.ORG_UNIT, it.key, it.names, it.updatedAt)
                }
            }
            CreationPolicyService.CAPABILITY -> {
                capabilityRepository.findById(id).orElse(null)?.let {
                    ResolvedItem(record.resourceType, TaskItemResourceType.CAPABILITY, it.key, it.names, it.updatedAt)
                }
            }
            else -> {
                null
            }
        }
    }

    /** Closes the review. Only the container's current owner (or an admin) may acknowledge it. */
    @Transactional
    open fun acknowledge(
        recordId: Long,
        user: User
    ) {
        val record =
            itemCreationRecordRepository
                .findById(recordId)
                .orElseThrow { ResourceNotFoundException("Creation review not found: $recordId") }
        val isAdmin = user.roles.contains(RoleService.ROLE_ADMIN)
        if (!isAdmin && (user.id == null || realmOwnerId(record) != user.id)) {
            throw ForbiddenOperationException("Only the owner of the place the item was created in may acknowledge its review")
        }
        record.reviewedById = user.id
        record.reviewedAt = Instant.now()
        itemCreationRecordRepository.update(record)
    }

    /** The review details shown with the to-do: who created the item, under which grant, and why. */
    @Transactional
    open fun reviewInfo(recordId: Long): CreationReviewInfo? {
        val record = itemCreationRecordRepository.findById(recordId).orElse(null) ?: return null
        val creator = record.createdById?.let { userRepository.findById(it).orElse(null) }
        return CreationReviewInfo(record.id)
            .createdAt(record.createdAt?.atZone(ZoneOffset.UTC))
            .createdBy(creator?.let { UserMapper.toUserSummary(it) })
            .basis(record.basis?.let { CreationBasisDto.fromValue(it) })
            .duplicateJustification(parseJustification(record.duplicateJustification))
            .acknowledgedCandidateKeys(record.acknowledgedCandidateKeys?.split("\n")?.filter { it.isNotBlank() } ?: emptyList())
    }

    private fun parseJustification(json: String?): List<org.leargon.backend.model.LocalizedText> {
        if (json.isNullOrBlank()) return emptyList()
        val entries: List<Map<String, String>> = objectMapper.readValue(json, object : TypeReference<List<Map<String, String>>>() {})
        return entries.map {
            org.leargon.backend.model
                .LocalizedText(it["locale"] ?: "", it["text"] ?: "")
        }
    }

    /** The saved item's id and the container it was placed in. */
    private fun locate(
        itemType: String,
        key: String
    ): Placement? =
        when (itemType) {
            CreationPolicyService.BUSINESS_ENTITY -> {
                businessEntityRepository.findByKey(key).orElse(null)?.let { e ->
                    when {
                        e.parent != null -> Placement(e.id!!, CreationPolicyService.BUSINESS_ENTITY, e.parent!!.id)
                        e.boundedContext != null -> Placement(e.id!!, CreationPolicyService.BOUNDED_CONTEXT, e.boundedContext!!.id)
                        e.owningUnit != null -> Placement(e.id!!, CreationPolicyService.ORGANISATIONAL_UNIT, e.owningUnit!!.id)
                        else -> Placement(e.id!!, null, null)
                    }
                }
            }
            CreationPolicyService.BUSINESS_PROCESS -> {
                processRepository.findByKey(key).orElse(null)?.let { p ->
                    when {
                        p.parent != null -> Placement(p.id!!, CreationPolicyService.BUSINESS_PROCESS, p.parent!!.id)
                        p.boundedContext != null -> Placement(p.id!!, CreationPolicyService.BOUNDED_CONTEXT, p.boundedContext!!.id)
                        p.owningUnit != null -> Placement(p.id!!, CreationPolicyService.ORGANISATIONAL_UNIT, p.owningUnit!!.id)
                        else -> Placement(p.id!!, null, null)
                    }
                }
            }
            CreationPolicyService.BUSINESS_DOMAIN -> {
                businessDomainRepository.findByKey(key).orElse(null)?.let { d ->
                    Placement(d.id!!, d.parent?.let { CreationPolicyService.BUSINESS_DOMAIN }, d.parent?.id)
                }
            }
            CreationPolicyService.BOUNDED_CONTEXT -> {
                boundedContextRepository.findByKey(key).orElse(null)?.let { bc ->
                    Placement(bc.id!!, CreationPolicyService.BUSINESS_DOMAIN, bc.domain?.id)
                }
            }
            CreationPolicyService.ORGANISATIONAL_UNIT -> {
                organisationalUnitRepository.findByKey(key).orElse(null)?.let { u ->
                    val parent = u.parents.firstOrNull()
                    Placement(u.id!!, parent?.let { CreationPolicyService.ORGANISATIONAL_UNIT }, parent?.id)
                }
            }
            CreationPolicyService.CAPABILITY -> {
                capabilityRepository.findByKey(key).orElse(null)?.let { c ->
                    Placement(c.id!!, c.parent?.let { CreationPolicyService.CAPABILITY }, c.parent?.id)
                }
            }
            else -> {
                null
            }
        }
}
