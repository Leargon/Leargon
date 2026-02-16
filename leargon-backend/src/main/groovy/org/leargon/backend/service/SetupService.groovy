package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.UserRepository

@Singleton
class SetupService {

    private final UserRepository userRepository
    private final UserMapper userMapper

    SetupService(UserRepository userRepository, UserMapper userMapper) {
        this.userRepository = userRepository
        this.userMapper = userMapper
    }

    @Transactional
    UserResponse completeSetup(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))

        if (!user.isFallbackAdministrator) {
            throw new ForbiddenOperationException("Only the fallback administrator can complete setup")
        }

        if (user.setupCompleted) {
            throw new ForbiddenOperationException("Setup has already been completed")
        }

        user.setupCompleted = true
        user = userRepository.update(user)
        return userMapper.toUserResponse(user)
    }
}
