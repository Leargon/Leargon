package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.User
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.exception.DuplicateResourceException
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import spock.lang.Specification

@MicronautTest(transactional = false)
class UserServiceSpec extends Specification {

    @Inject
    UserRepository userRepository

    @Inject
    PasswordEncoder passwordEncoder

    @Inject
    UserService userService

    def cleanup() {
        // Clean up test data after each test
        userRepository.deleteAll()
    }

    def "should create user with valid data"() {
        given: "a valid signup request"
        def request = new SignupRequest("john.doe@example.com", "johndoe", "password123", "John", "Doe")

        when: "creating a new user"
        def user = userService.createUser(request)

        then: "user is created successfully"
        user != null
        user.id != null
        user.email == "john.doe@example.com"
        user.username == "johndoe"
        user.firstName == "John"
        user.lastName == "Doe"
        user.enabled == true
        user.accountLocked == false
        user.accountExpired == false
        user.passwordExpired == false
        user.createdAt != null
        user.updatedAt != null

        and: "password is hashed"
        user.passwordHash != "password123"
        passwordEncoder.matches("password123", user.passwordHash)
    }

    def "should throw exception when creating user with duplicate email"() {
        given: "an existing user"
        def existingUser = new SignupRequest("existing@example.com", "existing", "password123", "Existing", "User")
        userService.createUser(existingUser)

        and: "a signup request with the same email"
        def duplicateRequest = new SignupRequest("existing@example.com", "different", "password123", "Different", "User")

        when: "attempting to create user with duplicate email"
        userService.createUser(duplicateRequest)

        then: "DuplicateResourceException is thrown"
        def exception = thrown(DuplicateResourceException)
        exception.message == "Email already exists"
    }

    def "should throw exception when creating user with duplicate username"() {
        given: "an existing user"
        def existingUser = new SignupRequest("user1@example.com", "johndoe", "password123", "John", "Doe")
        userService.createUser(existingUser)

        and: "a signup request with the same username"
        def duplicateRequest = new SignupRequest("user2@example.com", "johndoe", "password123", "Jane", "Doe")

        when: "attempting to create user with duplicate username"
        userService.createUser(duplicateRequest)

        then: "DuplicateResourceException is thrown"
        def exception = thrown(DuplicateResourceException)
        exception.message == "Username already exists"
    }

    def "should find user by email"() {
        given: "a created user"
        def request = new SignupRequest("findme@example.com", "findme", "password123", "Find", "Me")
        userService.createUser(request)

        when: "finding user by email"
        def result = userService.findByEmail("findme@example.com")

        then: "user is found"
        result.isPresent()
        result.get().email == "findme@example.com"
        result.get().username == "findme"
    }

    def "should return empty when user not found by email"() {
        when: "finding non-existent user"
        def result = userService.findByEmail("nonexistent@example.com")

        then: "empty optional is returned"
        !result.isPresent()
    }

    def "should get user by id"() {
        given: "a created user"
        def request = new SignupRequest("getme@example.com", "getme", "password123", "Get", "Me")
        def createdUser = userService.createUser(request)

        when: "getting user by id"
        def user = userService.getUserById(createdUser.id)

        then: "user is retrieved"
        user != null
        user.id == createdUser.id
        user.email == "getme@example.com"
    }

    def "should throw exception when getting non-existent user by id"() {
        when: "getting user with non-existent id"
        userService.getUserById(999999L)

        then: "ResourceNotFoundException is thrown"
        def exception = thrown(ResourceNotFoundException)
        exception.message == "User not found"
    }

    def "should update last login timestamp"() {
        given: "a created user"
        def request = new SignupRequest("login@example.com", "loginuser", "password123", "Login", "User")
        def user = userService.createUser(request)
        def originalLastLogin = user.lastLoginAt

        when: "updating last login"
        userService.updateLastLogin(user.id)

        and: "retrieving the user again"
        def updatedUser = userService.getUserById(user.id)

        then: "last login timestamp is updated"
        updatedUser.lastLoginAt != originalLastLogin
        updatedUser.lastLoginAt != null
    }

    def "should convert user to user response"() {
        given: "a user entity"
        def user = new User(
                id: 1L,
                email: "test@example.com",
                username: "testuser",
                firstName: "Test",
                lastName: "User",
                enabled: true,
                createdAt: null,
                lastLoginAt: null
        )

        when: "converting to user response"
        def response = userService.toUserResponse(user)

        then: "user response is created correctly"
        response.id == 1L
        response.email == "test@example.com"
        response.username == "testuser"
        response.firstName == "Test"
        response.lastName == "User"
        response.enabled == true
    }

    def "should create users with different emails and usernames"() {
        given: "multiple signup requests"
        def requests = [
                new SignupRequest("user1@example.com", "user1", "password123", "User", "One"),
                new SignupRequest("user2@example.com", "user2", "password123", "User", "Two"),
                new SignupRequest("user3@example.com", "user3", "password123", "User", "Three")
        ]

        when: "creating multiple users"
        def users = requests.collect { userService.createUser(it) }

        then: "all users are created"
        users.size() == 3
        users.every { it.id != null }
        users*.email == ["user1@example.com", "user2@example.com", "user3@example.com"]
        users*.username == ["user1", "user2", "user3"]
    }

    def "should throw ForbiddenOperationException when updating fallback admin"() {
        given: "a fallback admin user"
        def request = new SignupRequest("fallback@example.com", "fallbackadmin", "password123", "Fallback", "Admin")
        def user = userService.createUser(request)

        // Mark as fallback admin (only ROLE_ADMIN)
        user.isFallbackAdministrator = true
        user.roles = "ROLE_ADMIN"
        userRepository.update(user)

        and: "an update request"
        def updateRequest = new UpdateUserRequest()
        updateRequest.firstName = "New"
        updateRequest.lastName = "Name"

        when: "attempting to update fallback admin"
        userService.updateUser(user.id, updateRequest)

        then: "ForbiddenOperationException is thrown"
        def exception = thrown(ForbiddenOperationException)
        exception.message == "Cannot modify fallback admin user"
    }

    def "should throw ForbiddenOperationException when deleting fallback admin"() {
        given: "a fallback admin user"
        def request = new SignupRequest("fallback2@example.com", "fallbackadmin2", "password123", "Fallback", "Admin")
        def user = userService.createUser(request)

        // Mark as fallback admin (only ROLE_ADMIN)
        user.isFallbackAdministrator = true
        user.roles = "ROLE_ADMIN"
        userRepository.update(user)

        when: "attempting to delete fallback admin"
        userService.deleteUser(user.id)

        then: "ForbiddenOperationException is thrown"
        def exception = thrown(ForbiddenOperationException)
        exception.message == "Cannot delete fallback admin user"
    }

    def "should throw ForbiddenOperationException when changing fallback admin password"() {
        given: "a fallback admin user"
        def request = new SignupRequest("fallback3@example.com", "fallbackadmin3", "password123", "Fallback", "Admin")
        def user = userService.createUser(request)

        // Mark as fallback admin (only ROLE_ADMIN)
        user.isFallbackAdministrator = true
        user.roles = "ROLE_ADMIN"
        userRepository.update(user)

        and: "a password change request"
        def passwordRequest = new AdministrationChangePasswordRequest("newpassword123")

        when: "attempting to change fallback admin password"
        userService.adminChangePassword(user.id, passwordRequest)

        then: "ForbiddenOperationException is thrown"
        def exception = thrown(ForbiddenOperationException)
        exception.message == "Cannot change password of fallback admin user"
    }

    def "should allow updating regular admin user"() {
        given: "a regular admin user (not fallback)"
        def request = new SignupRequest("regularadmin@example.com", "regularadmin", "password123", "Regular", "Admin")
        def user = userService.createUser(request)

        // Make admin but NOT fallback admin
        user.isFallbackAdministrator = false
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)

        and: "an update request"
        def updateRequest = new UpdateUserRequest()
        updateRequest.firstName = "Updated"
        updateRequest.lastName = "Name"

        when: "updating regular admin"
        def updatedUser = userService.updateUser(user.id, updateRequest)

        then: "update is successful"
        updatedUser.firstName == "Updated"
        updatedUser.lastName == "Name"
    }
}
