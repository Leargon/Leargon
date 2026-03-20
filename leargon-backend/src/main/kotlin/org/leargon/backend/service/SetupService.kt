package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.UserRepository

@Singleton
open class SetupService(
    private val userRepository: UserRepository,
    private val userMapper: UserMapper
) {
    @Transactional
    open fun completeSetup(email: String): UserResponse {
        var user =
            userRepository
                .findByEmail(email)
                .orElseThrow { ResourceNotFoundException("User not found") }

        if (!user.isFallbackAdministrator) {
            throw ForbiddenOperationException("Only the fallback administrator can complete setup")
        }
        if (user.setupCompleted) {
            throw ForbiddenOperationException("Setup has already been completed")
        }

        user.setupCompleted = true
        user = userRepository.update(user)
        return userMapper.toUserResponse(user)
    }
}
