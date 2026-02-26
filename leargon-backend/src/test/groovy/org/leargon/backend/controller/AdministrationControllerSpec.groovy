package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UpdateUserRequest
import org.leargon.backend.model.UpdateUserRequestRolesInner
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class AdministrationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    def cleanup() {
        userRepository.deleteAll()
    }

    private String createAdminToken() {
        // Create and promote admin user
        def signupRequest = new SignupRequest("admin@example.com", "admin", "password123", "Admin", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))

        // Promote to admin via direct database update (simulating bootstrap)
        def user = userRepository.findByEmail("admin@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)

        // Login to get token
        def loginRequest = new LoginRequest("admin@example.com", "password123")
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", loginRequest),
                Map
        )
        return loginResponse.body().accessToken
    }

    private String createRegularUserToken() {
        def signupRequest = new SignupRequest("regular@example.com", "regular", "password123", "Regular", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                Map
        )
        return signupResponse.body().accessToken
    }

    def "POST /administration/users should create user and return 201"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "a signup request"
        def signupRequest = new SignupRequest("newuser@example.com", "newuser", "password123", "New", "User")

        when: "creating user"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users", signupRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is 201 Created"
        response.status == HttpStatus.CREATED

        and: "user details are returned"
        def created = response.body()
        created.email == "newuser@example.com"
        created.username == "newuser"
        created.firstName == "New"
        created.lastName == "User"
        created.enabled == true
    }

    def "POST /administration/users should return 409 for duplicate email"() {
        given: "an admin token and an existing user"
        String adminToken = createAdminToken()

        and: "a request with the same email"
        def signupRequest = new SignupRequest("admin@example.com", "anotherusername", "password123", "Another", "User")

        when: "creating user with duplicate email"
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users", signupRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "conflict exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.CONFLICT
    }

    def "POST /administration/users should return 409 for duplicate username"() {
        given: "an admin token and an existing user"
        String adminToken = createAdminToken()

        and: "a request with the same username"
        def signupRequest = new SignupRequest("different@example.com", "admin", "password123", "Another", "User")

        when: "creating user with duplicate username"
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users", signupRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "conflict exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.CONFLICT
    }

    def "POST /administration/users should return 401 without token"() {
        given: "a signup request"
        def signupRequest = new SignupRequest("newuser@example.com", "newuser", "password123", "New", "User")

        when: "creating user without token"
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users", signupRequest),
                UserResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "POST /administration/users should return 403 with regular user token"() {
        given: "a regular user token"
        String regularToken = createRegularUserToken()

        and: "a signup request"
        def signupRequest = new SignupRequest("newuser@example.com", "newuser", "password123", "New", "User")

        when: "creating user with regular token"
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users", signupRequest)
                        .bearerAuth(regularToken),
                UserResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "GET /administration/users should return all users with admin token"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        and: "multiple users exist"
        def user2 = new SignupRequest("user2@example.com", "user2", "password123", "User", "Two")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", user2))

        when: "getting all users"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/users")
                        .bearerAuth(adminToken),
                Argument.listOf(UserResponse)
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "all users are returned"
        def users = response.body()
        users.size() >= 2
        users.any { it.email == "admin@example.com" }
        users.any { it.email == "user2@example.com" }
    }

    def "GET /administration/users should return 401 without token"() {
        when: "requesting users without token"
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users"),
                List
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /administration/users should return 403 with regular user token"() {
        given: "a regular user token"
        String regularToken = createRegularUserToken()

        when: "requesting users with regular token"
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users")
                        .bearerAuth(regularToken),
                List
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "GET /administration/users/{id} should return user details"() {
        given: "an admin token and a user"
        String adminToken = createAdminToken()
        def user = userRepository.findByEmail("admin@example.com").get()

        when: "getting user by ID"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/users/${user.id}")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user details are returned"
        def userResponse = response.body()
        userResponse.email == "admin@example.com"
        userResponse.username == "admin"
        userResponse.roles.contains("ROLE_ADMIN")
    }

    def "GET /administration/users/{id} should return 404 for non-existent user"() {
        given: "an admin token"
        String adminToken = createAdminToken()

        when: "getting non-existent user"
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users/999999")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "not found exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.NOT_FOUND
    }

    def "PUT /administration/users/{id} should update user details"() {
        given: "an admin token and a user to update"
        String adminToken = createAdminToken()
        def signupRequest = new SignupRequest("toupdate@example.com", "toupdate", "password123", "Old", "Name")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))
        def user = userRepository.findByEmail("toupdate@example.com").get()

        and: "an update request"
        def updateRequest = new UpdateUserRequest()
        updateRequest.firstName = "New"
        updateRequest.lastName = "Name"
        updateRequest.enabled = true

        when: "updating user"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user is updated"
        def updated = response.body()
        updated.firstName == "New"
        updated.lastName == "Name"
        updated.email == "toupdate@example.com"  // Unchanged
    }

    def "PUT /administration/users/{id} should update user roles"() {
        given: "an admin token and a regular user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        and: "an update request with admin role"
        def updateRequest = new UpdateUserRequest()
        updateRequest.roles = [UpdateUserRequestRolesInner.USER, UpdateUserRequestRolesInner.ADMIN]

        when: "promoting user to admin"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user has admin role"
        def updated = response.body()
        updated.roles.contains("ROLE_ADMIN")
        updated.roles.contains("ROLE_USER")
    }

    def "PUT /administration/users/{id} should return 409 for duplicate email"() {
        given: "an admin token and two users"
        String adminToken = createAdminToken()

        def user1 = new SignupRequest("user1@example.com", "user1", "password123", "User", "One")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", user1))

        def user2 = new SignupRequest("user2@example.com", "user2", "password123", "User", "Two")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", user2))

        def user2BusinessEntity = userRepository.findByEmail("user2@example.com").get()

        and: "an update request with duplicate email"
        def updateRequest = new UpdateUserRequest()
        updateRequest.email = "user1@example.com"  // Already exists

        when: "updating with duplicate email"
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user2BusinessEntity.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "conflict exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.CONFLICT
    }

    def "DELETE /administration/users/{id} should soft-delete user"() {
        given: "an admin token and a user to delete"
        String adminToken = createAdminToken()

        def userToDelete = new SignupRequest("todelete@example.com", "todelete", "password123", "To", "Delete")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", userToDelete))
        def user = userRepository.findByEmail("todelete@example.com").get()

        when: "deleting user"
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/administration/users/${user.id}")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful with user data"
        response.status == HttpStatus.OK

        and: "user is soft-deleted (disabled)"
        def disabledUser = userRepository.findByEmail("todelete@example.com").get()
        !disabledUser.enabled
    }

    def "POST /administration/users/{id}/lock should lock user account"() {
        given: "an admin token and a user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        when: "locking user account"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${user.id}/lock", "")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "account is locked"
        response.body().accountLocked == true
    }

    def "POST /administration/users/{id}/unlock should unlock user account"() {
        given: "an admin token and a locked user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        // Lock the user first
        user.accountLocked = true
        userRepository.update(user)

        when: "unlocking user account"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${user.id}/unlock", "")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "account is unlocked"
        response.body().accountLocked == false
    }

    def "POST /administration/users/{id}/disable should disable user account"() {
        given: "an admin token and a user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        when: "disabling user account"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${user.id}/disable", "")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "account is disabled"
        response.body().enabled == false
    }

    def "POST /administration/users/{id}/enable should enable user account"() {
        given: "an admin token and a disabled user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        // Disable the user first
        user.enabled = false
        userRepository.update(user)

        when: "enabling user account"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${user.id}/enable", "")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "account is enabled"
        response.body().enabled == true
    }

    def "should not allow regular user to access any admin endpoint"() {
        given: "a regular user token"
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        expect: "all admin endpoints return 403"
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users").bearerAuth(regularToken),
                List
        )
        then:
        thrown(HttpClientResponseException)

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users/${user.id}").bearerAuth(regularToken),
                UserResponse
        )
        then:
        thrown(HttpClientResponseException)

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}", new UpdateUserRequest())
                        .bearerAuth(regularToken),
                UserResponse
        )
        then:
        thrown(HttpClientResponseException)

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/administration/users/${user.id}")
                        .bearerAuth(regularToken)
        )
        then:
        thrown(HttpClientResponseException)
    }

    def "PUT /administration/users/{id}/password should change user password"() {
        given: "an admin token and a regular user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        and: "a password change request"
        def passwordRequest = new AdministrationChangePasswordRequest("newpassword123")

        when: "changing user password"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}/password", passwordRequest)
                        .bearerAuth(adminToken)
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user can login with new password"
        def loginRequest = new LoginRequest("regular@example.com", "newpassword123")
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", loginRequest),
                Map
        )
        loginResponse.status == HttpStatus.OK
        loginResponse.body().accessToken != null
    }

    def "PUT /administration/users/{id}/password should return 403 for fallback admin"() {
        given: "an admin token and a fallback admin user"
        String adminToken = createAdminToken()
        def fallbackAdmin = userRepository.findByEmail("admin@example.com").get()

        // Mark as fallback admin
        fallbackAdmin.isFallbackAdministrator = true
        userRepository.update(fallbackAdmin)

        and: "a password change request"
        def passwordRequest = new AdministrationChangePasswordRequest("newpassword123")

        when: "attempting to change fallback admin password"
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${fallbackAdmin.id}/password", passwordRequest)
                        .bearerAuth(adminToken)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "PUT /administration/users/{id} should return 403 for fallback admin"() {
        given: "an admin token and a fallback admin user"
        String adminToken = createAdminToken()
        def fallbackAdmin = userRepository.findByEmail("admin@example.com").get()

        // Mark as fallback admin
        fallbackAdmin.isFallbackAdministrator = true
        userRepository.update(fallbackAdmin)

        and: "an update request"
        def updateRequest = new UpdateUserRequest()
        updateRequest.firstName = "New"
        updateRequest.lastName = "Name"

        when: "attempting to update fallback admin"
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${fallbackAdmin.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "DELETE /administration/users/{id} should return 403 for fallback admin"() {
        given: "an admin token and a fallback admin user"
        String adminToken = createAdminToken()
        def fallbackAdmin = userRepository.findByEmail("admin@example.com").get()

        // Mark as fallback admin
        fallbackAdmin.isFallbackAdministrator = true
        userRepository.update(fallbackAdmin)

        when: "attempting to delete fallback admin"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/administration/users/${fallbackAdmin.id}")
                        .bearerAuth(adminToken)
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "POST /administration/users/{id}/lock should return 403 for fallback admin"() {
        given: "an admin token and a fallback admin user"
        String adminToken = createAdminToken()
        def fallbackAdmin = userRepository.findByEmail("admin@example.com").get()

        // Mark as fallback admin
        fallbackAdmin.isFallbackAdministrator = true
        userRepository.update(fallbackAdmin)

        when: "attempting to lock fallback admin"
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${fallbackAdmin.id}/lock", "")
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "POST /administration/users/{id}/promote-admin should work via updateUser endpoint"() {
        given: "an admin token and a regular user"
        String adminToken = createAdminToken()
        String regularToken = createRegularUserToken()
        def user = userRepository.findByEmail("regular@example.com").get()

        and: "an update request to promote to admin"
        def updateRequest = new UpdateUserRequest()
        updateRequest.roles = [UpdateUserRequestRolesInner.USER, UpdateUserRequestRolesInner.ADMIN]

        when: "promoting user to admin"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user has admin role"
        def updated = response.body()
        updated.roles.contains("ROLE_ADMIN")
        updated.roles.contains("ROLE_USER")
    }

    def "POST /administration/users/{id}/demote-admin should work via updateUser endpoint"() {
        given: "an admin token and an admin user (not fallback)"
        String adminToken = createAdminToken()

        // Create another admin user
        def signupRequest = new SignupRequest("toDemote@example.com", "todemote", "password123", "To", "Demote")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))
        def user = userRepository.findByEmail("toDemote@example.com").get()

        // Make them admin (but not fallback)
        user.roles = "ROLE_USER,ROLE_ADMIN"
        user.isFallbackAdministrator = false
        userRepository.update(user)

        and: "an update request to demote from admin"
        def updateRequest = new UpdateUserRequest()
        updateRequest.roles = [UpdateUserRequestRolesInner.USER]

        when: "demoting user from admin"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}", updateRequest)
                        .bearerAuth(adminToken),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user only has user role"
        def updated = response.body()
        !updated.roles.contains("ROLE_ADMIN")
        updated.roles.contains("ROLE_USER")
    }
}
