package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.AdministrationChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Test specification for admin password change functionality.
 */
@MicronautTest(transactional = false)
class AdministrationChangePasswordSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    def cleanup() {
        userRepository.deleteAll()
    }

    String createAdminToken() {
        // Create admin user
        def adminSignup = new SignupRequest("admin@test.com", "admin", "Admin123", "Admin", "User")
        def adminResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', adminSignup),
                Map
        )
        def adminUser = userRepository.findByEmail('admin@test.com').get()
        adminUser.roles = 'ROLE_USER,ROLE_ADMIN'
        userRepository.update(adminUser)

        // Login as admin
        def loginRequest = [email: 'admin@test.com', password: 'Admin123']
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', loginRequest),
                Map
        )
        return loginResponse.body().accessToken
    }

    def "admin should change user password successfully"() {
        given: "an admin token and a regular user"
        def adminToken = createAdminToken()

        def userSignup = new SignupRequest("user@test.com", "user", "OldPassword123", "Test", "User")
        client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', userSignup),
                Map
        )
        def user = userRepository.findByEmail('user@test.com').get()

        when: "admin changes user password"
        def changeRequest = new AdministrationChangePasswordRequest("NewPassword123")
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}/password", changeRequest)
                        .bearerAuth(adminToken),
                String
        )

        then: "password is changed successfully"
        response.status == HttpStatus.OK

        and: "user can login with new password"
        def newLoginRequest = [email: 'user@test.com', password: 'NewPassword123']
        def newLoginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', newLoginRequest),
                Map
        )
        newLoginResponse.status == HttpStatus.OK
        newLoginResponse.body().accessToken != null

        and: "user cannot login with old password"
        def oldLoginRequest = [email: 'user@test.com', password: 'OldPassword123']
        HttpClientResponseException exception = null
        try {
            client.toBlocking().exchange(
                    HttpRequest.POST('/authentication/login', oldLoginRequest),
                    Map
            )
        } catch (HttpClientResponseException e) {
            exception = e
        }
        exception != null
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "should reject password change without admin role"() {
        given: "a regular user token"
        def userSignup = new SignupRequest("regular@test.com", "regular", "Password123", "Regular", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', userSignup),
                Map
        )
        def userToken = signupResponse.body().accessToken
        def user = userRepository.findByEmail('regular@test.com').get()

        when: "regular user tries to change another user's password"
        def changeRequest = new AdministrationChangePasswordRequest("NewPassword123")
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}/password", changeRequest)
                        .bearerAuth(userToken),
                String
        )

        then: "request is rejected with 403"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "should reject password change without authentication"() {
        when: "unauthenticated user tries to change password"
        def changeRequest = new AdministrationChangePasswordRequest("NewPassword123")
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/1/password", changeRequest),
                String
        )

        then: "request is rejected with 401"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "should reject password change with invalid new password"() {
        given: "an admin token and a regular user"
        def adminToken = createAdminToken()

        def userSignup = new SignupRequest("shortpass@test.com", "shortpass", "ValidPassword123", "Short", "Pass")
        client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', userSignup),
                Map
        )
        def user = userRepository.findByEmail('shortpass@test.com').get()

        when: "admin tries to set too short password"
        def changeRequest = new AdministrationChangePasswordRequest("short")
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${user.id}/password", changeRequest)
                        .bearerAuth(adminToken),
                String
        )

        then: "request is rejected with 400"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }
}
