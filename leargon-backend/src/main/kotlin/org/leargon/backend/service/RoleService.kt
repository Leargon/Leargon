package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException

/**
 * Parses and interprets the comma-separated [User.roles] string into the role model:
 *  - global roles: ROLE_USER, ROLE_ADMIN
 *  - methodology-scoped roles: ROLE_EDITOR_<M> and ROLE_LEAD_<M> (lead ⇒ editor for the same M)
 *
 * EDITOR_<M> may edit content fields belonging to methodology M (treated as a non-owner, so edits
 * land UNVERIFIED — verification stays owner-only). LEAD_<M> additionally manages M's configuration.
 */
@Singleton
class RoleService(
    private val methodologyConfigurationService: MethodologyConfigurationService,
    private val fieldConfigurationService: FieldConfigurationService
) {
    data class RoleScopes(
        val isAdmin: Boolean,
        val editorMethodologies: Set<String>,
        val leadMethodologies: Set<String>
    )

    fun scopesOf(user: User): RoleScopes {
        val valid = methodologyConfigurationService.allKeys.toSet()
        val tokens =
            user.roles
                .split(",")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        val editors = mutableSetOf<String>()
        val leads = mutableSetOf<String>()
        for (token in tokens) {
            when {
                token.startsWith(ROLE_LEAD_PREFIX) -> {
                    val m = token.removePrefix(ROLE_LEAD_PREFIX)
                    if (m in valid) {
                        leads.add(m)
                        editors.add(m) // lead implies editor for the same methodology
                    }
                }
                token.startsWith(ROLE_EDITOR_PREFIX) -> {
                    val m = token.removePrefix(ROLE_EDITOR_PREFIX)
                    if (m in valid) editors.add(m)
                }
            }
        }
        return RoleScopes(tokens.contains(ROLE_ADMIN), editors, leads)
    }

    fun isEditorFor(
        user: User,
        methodology: String
    ): Boolean = scopesOf(user).let { it.isAdmin || methodology in it.editorMethodologies }

    fun isLeadFor(
        user: User,
        methodology: String
    ): Boolean = scopesOf(user).let { it.isAdmin || methodology in it.leadMethodologies }

    /**
     * Throws unless [user] may create a *root* (top-level) catalogue item governed by [methodology]:
     * an administrator, or an EDITOR/LEAD of that methodology.
     */
    fun requireCreateRoot(
        user: User,
        methodology: String
    ) {
        if (!isEditorFor(user, methodology)) {
            throw ForbiddenOperationException(
                "Creating this item requires an administrator or a $methodology editor/lead role"
            )
        }
    }

    /**
     * Throws unless [user] may create a *child* of a parent item governed by [methodology]: an
     * administrator or EDITOR/LEAD of that methodology, or the owner or steward of the parent item.
     */
    fun requireCreateChild(
        user: User,
        methodology: String,
        parentOwnerId: Long?,
        parentStewardId: Long?
    ) {
        if (isEditorFor(user, methodology)) return
        val uid = user.id
        if (uid != null && (uid == parentOwnerId || uid == parentStewardId)) return
        throw ForbiddenOperationException(
            "Creating this item requires an administrator, a $methodology editor/lead, " +
                "or ownership/stewardship of the parent item"
        )
    }

    /**
     * Throws unless [user] is an administrator or an EDITOR/LEAD of [methodology]. Used to gate edit/delete
     * (and create) of items that have no per-user owner/steward and are wholly governed by one methodology
     * (e.g. service providers, IT systems, capabilities, domains, bounded contexts, context relationships,
     * domain events).
     */
    fun requireEditorFor(
        user: User,
        methodology: String
    ) {
        if (!isEditorFor(user, methodology)) {
            throw ForbiddenOperationException(
                "This action requires an administrator or a $methodology editor/lead role"
            )
        }
    }

    /**
     * Throws unless [user] may delete an object of [entityType]: an administrator or EDITOR/LEAD of the
     * type's governing methodology, or the object's owner or steward. Symmetric with create.
     */
    fun requireDelete(
        user: User,
        entityType: String,
        ownerId: Long?,
        stewardId: Long?
    ) {
        val governing = GOVERNING_METHODOLOGY[entityType]
        if (governing != null && isEditorFor(user, governing)) return
        if (user.roles.contains(ROLE_ADMIN)) return
        val uid = user.id
        if (uid != null && (uid == ownerId || uid == stewardId)) return
        throw ForbiddenOperationException(
            "Deleting this item requires an administrator, a $governing editor/lead, or ownership/stewardship"
        )
    }

    /**
     * Whether the user may edit [fieldName] on [entityType] purely by virtue of a scoped EDITOR/LEAD role
     * (owner/steward/admin are checked separately by the caller). True when the field belongs to a
     * methodology the user is an editor (or lead) for. CORE-only fields belong to no methodology and so
     * are never editable by a scoped role alone.
     */
    fun canEditFieldByRole(
        user: User,
        entityType: String,
        fieldName: String
    ): Boolean {
        val scopes = scopesOf(user)
        if (scopes.isAdmin) return true
        if (scopes.editorMethodologies.isEmpty()) return false
        val section = fieldConfigurationService.sectionOf(entityType, fieldName)
        val methodologies = methodologyConfigurationService.methodologiesOf(entityType, fieldName, section)
        if (methodologies.any { it in scopes.editorMethodologies }) return true
        // CORE fields belong to no methodology. Allow an editor/lead of the entity type's *governing*
        // methodology (the one that also governs creating that type) to edit them — e.g. a DATA_GOVERNANCE
        // editor/lead may rename a business entity or reparent it.
        if (methodologies.isEmpty()) {
            val governing = GOVERNING_METHODOLOGY[entityType]
            return governing != null && governing in scopes.editorMethodologies
        }
        return false
    }

    /**
     * Whether [user] may edit [fieldName] on a specific record, combining per-record ownership/stewardship
     * (passed by the caller) with admin and scoped-role rights. This is the single predicate every per-field
     * edit gate enforces (`requireFieldEdit`, quality-rule/classification checks) — reused here so a
     * backend-computed [editableFields] cannot drift from enforcement.
     */
    fun canEditField(
        user: User,
        entityType: String,
        fieldName: String,
        isOwner: Boolean,
        isSteward: Boolean
    ): Boolean =
        user.roles.contains(ROLE_ADMIN) ||
            isOwner ||
            isSteward ||
            canEditFieldByRole(user, entityType, roleCheckFieldName(fieldName))

    /**
     * Base field names of [entityType] that [user] may edit on a record they own/steward as indicated.
     * The keys match what the frontend gates edit affordances on (see [FieldConfigurationService.baseFieldNames]).
     */
    fun editableFields(
        user: User,
        entityType: String,
        isOwner: Boolean,
        isSteward: Boolean
    ): List<String> =
        fieldConfigurationService
            .baseFieldNames(entityType)
            .filter { canEditField(user, entityType, it, isOwner, isSteward) }

    /**
     * Maps a base field name to the field name its enforcement uses for the scoped-role check. Only
     * `classification` differs: the backend gates classification assignment via `classification.value`.
     */
    private fun roleCheckFieldName(baseFieldName: String): String =
        if (baseFieldName == "classification") "classification.value" else baseFieldName

    /** Every assignable methodology-scoped role token, for admin pickers and request validation. */
    fun allScopedRoleTokens(): List<String> =
        methodologyConfigurationService.allKeys.flatMap {
            listOf("$ROLE_LEAD_PREFIX$it", "$ROLE_EDITOR_PREFIX$it")
        }

    fun isValidRoleToken(token: String): Boolean = token == ROLE_USER || token == ROLE_ADMIN || token in allScopedRoleTokens()

    companion object {
        const val ROLE_USER = "ROLE_USER"
        const val ROLE_ADMIN = "ROLE_ADMIN"
        const val ROLE_LEAD_PREFIX = "ROLE_LEAD_"
        const val ROLE_EDITOR_PREFIX = "ROLE_EDITOR_"

        /** The methodology that governs each entity type's CORE fields and creation. */
        @JvmStatic
        val GOVERNING_METHODOLOGY =
            mapOf(
                "BUSINESS_ENTITY" to "DATA_GOVERNANCE",
                "BUSINESS_PROCESS" to "PROCESS_GOVERNANCE",
                "BUSINESS_DOMAIN" to "DDD",
                "ORGANISATIONAL_UNIT" to "TEAM_TOPOLOGIES",
            )
    }
}
