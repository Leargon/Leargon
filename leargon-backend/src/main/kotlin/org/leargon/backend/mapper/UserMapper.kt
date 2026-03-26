package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateProfileRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.model.UserResponsePreferredRole
import org.leargon.backend.model.UserSummaryResponse
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
open class UserMapper {
    fun toUser(request: SignupRequest): User {
        val user = User()
        user.email = request.email
        user.username = request.username
        user.firstName = request.firstName
        user.lastName = request.lastName
        user.roles = "ROLE_USER"
        user.enabled = true
        user.isFallbackAdministrator = false
        user.setupCompleted = false
        user.preferredLanguage = "en"
        return user
    }

    fun toUserResponse(user: User): UserResponse =
        UserResponse(
            user.id,
            user.email,
            user.username,
            user.firstName,
            user.lastName,
            user.preferredLanguage,
            user.enabled,
            user.isFallbackAdministrator,
            user.setupCompleted,
            parseRoles(user.roles),
            toZonedDateTime(user.createdAt),
            toZonedDateTime(user.updatedAt)
        ).lastLoginAt(toZonedDateTime(user.lastLoginAt))
            .authProvider(user.authProvider)
            .preferredRole(user.preferredRole?.let { UserResponsePreferredRole.fromValue(it) })

    fun updateUserFromRequest(
        request: UpdateUserRequest,
        user: User
    ) {
        if (request.email != null) user.email = request.email!!
        if (request.username != null) user.username = request.username!!
        if (request.firstName != null) user.firstName = request.firstName!!
        if (request.lastName != null) user.lastName = request.lastName!!
        if (request.preferredLanguage != null) user.preferredLanguage = request.preferredLanguage!!
        if (request.enabled != null) user.enabled = request.enabled!!
        user.roles = mapRoles(request, user)
    }

    fun updateProfileFromRequest(
        request: UpdateProfileRequest,
        user: User
    ) {
        if (request.preferredLanguage != null) user.preferredLanguage = request.preferredLanguage!!
        if (request.preferredRole != null) user.preferredRole = request.preferredRole!!.value
    }

    fun parseRoles(rolesString: String?): List<String> {
        if (rolesString.isNullOrEmpty()) return emptyList()
        return rolesString.split(",")
    }

    fun mapRoles(
        request: UpdateUserRequest,
        user: User
    ): String {
        val roles = request.roles
        if (roles.isNullOrEmpty()) return user.roles
        return roles.map { it.value }.joinToString(",")
    }

    companion object {
        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)

        @JvmStatic
        fun toUserSummary(user: User?): UserSummaryResponse? {
            if (user == null) return null
            return UserSummaryResponse(
                user.username,
                user.firstName,
                user.lastName,
                user.preferredLanguage
            )
        }
    }
}
