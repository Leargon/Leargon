package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UpdateUserRequestRolesInner
import org.leargon.backend.model.UserResponse
import org.leargon.backend.model.UserSummaryResponse

import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
class UserMapper {

    User toUser(SignupRequest request) {
        User user = new User()
        user.email = request.email
        user.username = request.username
        user.firstName = request.firstName
        user.lastName = request.lastName
        user.roles = "ROLE_USER"
        user.enabled = true
        user.accountLocked = false
        user.accountExpired = false
        user.passwordExpired = false
        user.isFallbackAdministrator = false
        user.setupCompleted = false
        user.preferredLanguage = "en"
        return user
    }

    UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.id,
                user.email,
                user.username,
                user.firstName,
                user.lastName,
                user.preferredLanguage,
                user.enabled,
                user.accountLocked,
                user.accountExpired,
                user.passwordExpired,
                user.isFallbackAdministrator,
                user.setupCompleted,
                parseRoles(user.roles),
                toZonedDateTime(user.createdAt),
                toZonedDateTime(user.updatedAt)
        ).lastLoginAt(toZonedDateTime(user.lastLoginAt))
                .authProvider(user.authProvider)
    }

    void updateUserFromRequest(UpdateUserRequest request, User user) {
        if (request.email != null) user.email = request.email
        if (request.username != null) user.username = request.username
        if (request.firstName != null) user.firstName = request.firstName
        if (request.lastName != null) user.lastName = request.lastName
        if (request.preferredLanguage != null) user.preferredLanguage = request.preferredLanguage
        if (request.enabled != null) user.enabled = request.enabled
        if (request.accountLocked != null) user.accountLocked = request.accountLocked
        if (request.accountExpired != null) user.accountExpired = request.accountExpired
        if (request.passwordExpired != null) user.passwordExpired = request.passwordExpired
        user.roles = mapRoles(request.roles, user)
    }

    List<String> parseRoles(String rolesString) {
        if (rolesString == null || rolesString.isEmpty()) {
            return Collections.emptyList()
        }
        return Arrays.asList(rolesString.split(","))
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }

    String mapRoles(List<UpdateUserRequestRolesInner> roles, User user) {
        if (roles == null || roles.isEmpty()) {
            return user.roles
        }
        return roles.collect { it.value }.join(",")
    }

    static UserSummaryResponse toUserSummary(User user) {
        if (user == null) {
            return null
        }
        return new UserSummaryResponse(
                user.username,
                user.firstName,
                user.lastName,
                user.preferredLanguage
        )
    }
}
