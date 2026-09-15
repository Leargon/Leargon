package org.leargon.backend.controller

import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import org.leargon.backend.api.CreationApi
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.LocalizedTextMapper
import org.leargon.backend.model.CreatableItemType
import org.leargon.backend.model.CreationCapabilitiesResponse
import org.leargon.backend.model.CreationCapability
import org.leargon.backend.model.CreationTargetRef
import org.leargon.backend.model.CreationTargetsResponse
import org.leargon.backend.service.CreationPolicyService
import org.leargon.backend.service.CreationRequirementService
import org.leargon.backend.service.UserService
import org.leargon.backend.model.CreationBasis as CreationBasisDto

/**
 * Exposes the creation policy to the UI (which "New" buttons to show, which containers to offer in the
 * creation wizards) so the frontend never re-implements who may create what, where.
 */
@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class CreationController(
    private val creationPolicyService: CreationPolicyService,
    private val creationRequirementService: CreationRequirementService,
    private val duplicateCandidateService: org.leargon.backend.service.DuplicateCandidateService,
    private val creationRecordService: org.leargon.backend.service.CreationRecordService,
    private val userService: UserService,
    private val securityService: SecurityService
) : CreationApi {
    override fun getCreationCapabilities(): CreationCapabilitiesResponse {
        val user = getCurrentUser()
        val policy = creationPolicyService
        val items =
            CreationPolicyService.ALL_ITEM_TYPES.map { type ->
                val targets = policy.targets(user, type)
                CreationCapability(CreatableItemType.fromValue(type), targets.creatableFromList(type), targets.canCreateUnplaced)
            }
        return CreationCapabilitiesResponse(items)
    }

    override fun getCreationTargets(itemType: CreatableItemType): CreationTargetsResponse {
        val targets = creationPolicyService.targets(getCurrentUser(), itemType.value)
        return CreationTargetsResponse(
            itemType,
            targets.unrestricted,
            targets.canCreateUnplaced,
            targets.parents.map { toRef(it) },
            targets.boundedContexts.map { toRef(it) },
            targets.domains.map { toRef(it) },
            targets.owningUnits.map { toRef(it) }
        ).requiredFields(creationRequirementService.requiredFields(itemType.value))
    }

    override fun checkDuplicateCandidates(duplicateCheckRequest: org.leargon.backend.model.DuplicateCheckRequest): org.leargon.backend.model.DuplicateCheckResponse {
        getCurrentUser()
        val target =
            org.leargon.backend.service.CreationTarget(
                duplicateCheckRequest.itemType.value,
                parentKey = duplicateCheckRequest.parentKey,
                parentKeys = duplicateCheckRequest.parentKeys.orEmpty(),
                boundedContextKey = duplicateCheckRequest.boundedContextKey,
                domainKey = duplicateCheckRequest.domainKey,
                owningUnitKey = duplicateCheckRequest.owningUnitKey
            )
        val candidates = duplicateCandidateService.candidates(target, duplicateCheckRequest.names.map { it.text })
        return org.leargon.backend.model.DuplicateCheckResponse(candidates.any { it.blocking }, candidates)
    }

    override fun acknowledgeCreationReview(recordId: Long): io.micronaut.http.HttpResponse<Void> {
        creationRecordService.acknowledge(recordId, getCurrentUser())
        return io.micronaut.http.HttpResponse.noContent()
    }

    private fun toRef(ref: CreationPolicyService.TargetRef): CreationTargetRef =
        CreationTargetRef(ref.key, LocalizedTextMapper.toModel(ref.names), CreationBasisDto.fromValue(ref.basis.name))

    private fun getCurrentUser(): User {
        val email = securityService.username().orElseThrow { ResourceNotFoundException("User not authenticated") }
        return userService.findByEmail(email).orElseThrow { ResourceNotFoundException("User not found") }
    }
}
