package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.ChangePasswordRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import spock.lang.Specification

/**
 * Test specification for password change functionality.
 */
@MicronautTest(transactional = false)
class ChangePasswordSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Inject
    PasswordEncoder passwordEncoder

    def cleanup() {
        // Clean up test data after each test
        userRepository.deleteAll()
    }

    def "should change password successfully"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("changepass@test.com", "changepassuser", "OldPassword123", "Change", "Pass")

        client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', signupRequest)
        )

        // Login to get token
        def loginRequest = [email: 'changepass@test.com', password: 'OldPassword123']
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', loginRequest),
                Map
        )
        def token = loginResponse.body().accessToken

        when: "user changes their password"
        def changeRequest = new ChangePasswordRequest("OldPassword123", "NewPassword123")

        def response = client.toBlocking().exchange(
                HttpRequest.POST('/users/me/password', changeRequest)
                        .bearerAuth(token),
                String
        )

        then: "password is changed successfully"
        response.status == HttpStatus.OK

        and: "user can login with new password"
        def newLoginRequest = [email: 'changepass@test.com', password: 'NewPassword123']
        def newLoginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', newLoginRequest),
                Map
        )
        newLoginResponse.status == HttpStatus.OK
        newLoginResponse.body().accessToken != null

        and: "user cannot login with old password"
        def oldLoginRequest = [email: 'changepass@test.com', password: 'OldPassword123']
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

    def "should reject password change with incorrect current password"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("wrongpass@test.com", "wrongpassuser", "CorrectPassword123", "Wrong", "Pass")

        client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', signupRequest)
        )

        // Login to get token
        def loginRequest = [email: 'wrongpass@test.com', password: 'CorrectPassword123']
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', loginRequest),
                Map
        )
        def token = loginResponse.body().accessToken

        when: "user tries to change password with incorrect current password"
        def changeRequest = new ChangePasswordRequest("WrongPassword123", "NewPassword123")

        client.toBlocking().exchange(
                HttpRequest.POST('/users/me/password', changeRequest)
                        .bearerAuth(token),
                String
        )

        then: "request is rejected with 401"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
        exception.response.getBody(Map).get().message == "Current password is incorrect"
    }

    def "should reject password change without authentication"() {
        when: "unauthenticated user tries to change password"
        def changeRequest = new ChangePasswordRequest("OldPassword123", "NewPassword123")

        client.toBlocking().exchange(
                HttpRequest.POST('/users/me/password', changeRequest),
                String
        )

        then: "request is rejected with 401"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "should reject password change with invalid new password"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("shortpass@test.com", "shortpassuser", "ValidPassword123", "Short", "Pass")

        client.toBlocking().exchange(
                HttpRequest.POST('/authentication/signup', signupRequest)
        )

        // Login to get token
        def loginRequest = [email: 'shortpass@test.com', password: 'ValidPassword123']
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST('/authentication/login', loginRequest),
                Map
        )
        def token = loginResponse.body().accessToken

        when: "user tries to change password to too short password"
        def changeRequest = new ChangePasswordRequest("ValidPassword123", "short")

        client.toBlocking().exchange(
                HttpRequest.POST('/users/me/password', changeRequest)
                        .bearerAuth(token),
                String
        )

        then: "request is rejected with 400"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }
}
