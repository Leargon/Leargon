package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.ChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder

import java.time.Instant

/**
 * Service for user management operations.
 * Handles user creation, retrieval, and updates.
 */
@Singleton
class UserService {

    private final UserRepository userRepository
    private final PasswordEncoder passwordEncoder
    private final UserMapper userMapper

    UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, UserMapper userMapper) {
        this.userRepository = userRepository
        this.passwordEncoder = passwordEncoder
        this.userMapper = userMapper
    }

    /**
     * Create a new user account.
     * Validates email and username uniqueness before creation.
     * Passwords are securely hashed using BCrypt before storage.
     *
     * @param request Signup request with user details
     * @return Created User entity with generated ID
     * @throws DuplicateResourceException if email or username already exists
     */
    @Transactional
    User createUser(SignupRequest request) {
        // Check for duplicate email
        if (userRepository.existsByEmail(request.email)) {
            throw new DuplicateResourceException("Email already exists")
        }

        // Check for duplicate username
        if (userRepository.existsByUsername(request.username)) {
            throw new DuplicateResourceException("Username already exists")
        }

        // Create new user with hashed password
        User user = userMapper.toUser(request)
        user.passwordHash = passwordEncoder.encode(request.password)
        user.enabled = true
        user.accountLocked = false
        user.accountExpired = false
        user.passwordExpired = false

        return userRepository.save(user)
    }

    /**
     * Find user by email address.
     *
     * @param email User's email address
     * @return Optional containing User if found, empty otherwise
     */
    Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email)
    }

    /**
     * Get user by ID.
     *
     * @param id User ID
     * @return User entity
     * @throws ResourceNotFoundException if user not found
     */
    User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
    }

    /**
     * Update user's last login timestamp to current time.
     * Returns the updated user entity.
     *
     * @param userId ID of user to update
     * @return Updated User entity with new lastLoginAt timestamp
     * @throws ResourceNotFoundException if user not found
     */
    @Transactional
    User updateLastLogin(Long userId) {
        User user = getUserById(userId)
        user.lastLoginAt = Instant.now()
        return userRepository.update(user)
    }

    /**
     * Convert User entity to UserResponse DTO.
     * Excludes sensitive information like password hash.
     *
     * @param user User entity to convert
     * @return UserResponse DTO for API responses
     */
    UserResponse toUserResponse(User user) {
        return userMapper.toUserResponse(user)
    }

    /**
     * Get all users (admin only).
     *
     * @return List of all users
     */
    List<User> getAllUsers() {
        return userRepository.findAll() as List<User>
    }

    /**
     * Get all users as response DTOs (admin only).
     *
     * @return List of all users as UserResponse DTOs
     */
    List<UserResponse> getAllUsersAsResponses() {
        def users = userRepository.findAll()
        def result = []
        for (User user : users) {
            result.add(toUserResponse(user))
        }
        return result
    }

    /**
     * Update user details (admin only).
     * Validates email and username uniqueness if changed.
     *
     * @param userId ID of user to update
     * @param request Update request with new values
     * @return Updated User entity
     * @throws ResourceNotFoundException if user not found
     * @throws DuplicateResourceException if email or username already exists
     */
    @Transactional
    User updateUser(Long userId, UpdateUserRequest request) {
        User user = getUserById(userId)

        // Protect fallback admin from modification
        if (user.isFallbackAdministrator) {
            throw new ForbiddenOperationException("Cannot modify fallback admin user")
        }

        // Check email uniqueness if changed
        if (request.email && request.email != user.email) {
            if (userRepository.existsByEmail(request.email)) {
                throw new DuplicateResourceException("Email already exists")
            }
        }

        // Check username uniqueness if changed
        if (request.username && request.username != user.username) {
            if (userRepository.existsByUsername(request.username)) {
                throw new DuplicateResourceException("Username already exists")
            }
        }

        // Apply updates using businessEntityMapper
        userMapper.updateUserFromRequest(request, user)

        return userRepository.update(user)
    }

    /**
     * Delete user (admin only).
     *
     * @param userId ID of user to delete
     * @throws ResourceNotFoundException if user not found
     */
    @Transactional
    User deleteUser(Long userId) {
        User user = getUserById(userId)

        // Protect fallback admin from deletion
        if (user.isFallbackAdministrator) {
            throw new ForbiddenOperationException("Cannot delete fallback admin user")
        }

        // Soft delete — disable the account
        user.enabled = false
        return userRepository.update(user)
    }

    /**
     * Check if user has a specific role.
     *
     * @param user User to check
     * @param role Role to check for (e.g., "ROLE_ADMIN")
     * @return true if user has the role, false otherwise
     */
    boolean hasRole(User user, String role) {
        return user.roles?.split(',')?.contains(role) ?: false
    }

    /**
     * Get user roles as a list.
     *
     * @param user User to get roles for
     * @return List of role strings
     */
    List<String> getUserRoles(User user) {
        return user.roles?.split(',')?.toList() ?: ['ROLE_USER']
    }

    /**
     * Change user password.
     * Verifies current password before allowing change.
     *
     * @param userId ID of user changing password
     * @param request Password change request with current and new passwords
     * @throws ResourceNotFoundException if user not found
     * @throws AuthenticationException if current password is incorrect
     */
    @Transactional
    void changePassword(Long userId, ChangePasswordRequest request) {
        User user = getUserById(userId)

        // Protect fallback admin from password change
        if (user.isFallbackAdministrator) {
            throw new ForbiddenOperationException("Cannot change password of fallback admin user")
        }

        // Verify current password
        if (!passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            throw new AuthenticationException("Current password is incorrect")
        }

        // Hash and set new password
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        userRepository.update(user)
    }

    /**
     * Admin change user password.
     * Admin can reset password without knowing current password.
     *
     * @param userId ID of user whose password to change
     * @param request Password change request with new password
     * @throws ResourceNotFoundException if user not found
     */
    @Transactional
    void adminChangePassword(Long userId, AdministrationChangePasswordRequest request) {
        User user = getUserById(userId)

        // Protect fallback admin from password change
        if (user.isFallbackAdministrator) {
            throw new ForbiddenOperationException("Cannot change password of fallback admin user")
        }

        // Hash and set new password
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        userRepository.update(user)
    }
}
