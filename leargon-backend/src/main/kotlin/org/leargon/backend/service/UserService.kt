package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.ChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import java.time.Instant
import java.util.Optional

@Singleton
open class UserService(
    private val userRepository: UserRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val passwordEncoder: PasswordEncoder,
    private val userMapper: UserMapper
) {
    @Transactional
    open fun createUser(request: SignupRequest): User {
        if (userRepository.existsByEmail(request.email)) {
            throw DuplicateResourceException("Email already exists")
        }
        if (userRepository.existsByUsername(request.username)) {
            throw DuplicateResourceException("Username already exists")
        }
        val user = userMapper.toUser(request)
        user.passwordHash = passwordEncoder.encode(request.password)
        user.enabled = true
        return userRepository.save(user)
    }

    open fun findByEmail(email: String): Optional<User> = userRepository.findByEmail(email)

    open fun getUserById(id: Long): User = userRepository.findById(id).orElseThrow { ResourceNotFoundException("User not found") }

    @Transactional
    open fun updateLastLogin(userId: Long): User {
        val user = getUserById(userId)
        user.lastLoginAt = Instant.now()
        return userRepository.update(user)
    }

    open fun toUserResponse(user: User): UserResponse = userMapper.toUserResponse(user)

    open fun getAllUsersAsResponses(): List<UserResponse> = userRepository.findAll().map { toUserResponse(it) }

    @Transactional
    open fun updateUser(
        userId: Long,
        request: UpdateUserRequest
    ): User {
        val user = getUserById(userId)
        if (user.isFallbackAdministrator) {
            throw ForbiddenOperationException("Cannot modify fallback admin user")
        }
        if (request.email != null && request.email != user.email) {
            if (userRepository.existsByEmail(request.email!!)) {
                throw DuplicateResourceException("Email already exists")
            }
        }
        if (request.username != null && request.username != user.username) {
            if (userRepository.existsByUsername(request.username!!)) {
                throw DuplicateResourceException("Username already exists")
            }
        }
        userMapper.updateUserFromRequest(request, user)
        return userRepository.update(user)
    }

    @Transactional
    open fun deleteUser(userId: Long) {
        val user = getUserById(userId)
        if (user.isFallbackAdministrator) {
            throw ForbiddenOperationException("Cannot delete fallback admin user")
        }
        val ownedEntities = businessEntityRepository.findByDataOwnerId(userId)
        if (ownedEntities.isNotEmpty()) {
            val suffix = if (ownedEntities.size == 1) "y" else "ies"
            throw ForbiddenOperationException(
                "Cannot delete user who is data owner of ${ownedEntities.size} business entit$suffix. Reassign ownership first."
            )
        }
        val ownedProcesses = processRepository.findByProcessOwnerId(userId)
        if (ownedProcesses.isNotEmpty()) {
            val suffix = if (ownedProcesses.size == 1) "" else "es"
            throw ForbiddenOperationException(
                "Cannot delete user who is process owner of ${ownedProcesses.size} process$suffix. Reassign ownership first."
            )
        }
        val ledUnits = organisationalUnitRepository.findByLeadId(userId)
        if (ledUnits.isNotEmpty()) {
            val suffix = if (ledUnits.size == 1) "" else "s"
            throw ForbiddenOperationException(
                "Cannot delete user who is lead of ${ledUnits.size} organisational unit$suffix. Reassign lead first."
            )
        }
        userRepository.delete(user)
    }

    open fun getUserRoles(user: User): List<String> = user.roles.split(',').toList()

    @Transactional
    open fun changePassword(
        userId: Long,
        request: ChangePasswordRequest
    ) {
        val user = getUserById(userId)
        if (user.isFallbackAdministrator) {
            throw ForbiddenOperationException("Cannot change password of fallback admin user")
        }
        if (!passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            throw AuthenticationException("Current password is incorrect")
        }
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        userRepository.update(user)
    }

    @Transactional
    open fun adminChangePassword(
        userId: Long,
        request: AdministrationChangePasswordRequest
    ) {
        val user = getUserById(userId)
        if (user.isFallbackAdministrator) {
            throw ForbiddenOperationException("Cannot change password of fallback admin user")
        }
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        userRepository.update(user)
    }
}
