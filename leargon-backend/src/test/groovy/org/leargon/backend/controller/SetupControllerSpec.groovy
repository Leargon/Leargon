package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class SetupControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    def cleanup() {
        userRepository.deleteAll()
    }

    private String createFallbackAdminToken() {
        def signupRequest = new SignupRequest("fallback@example.com", "fallbackadmin", "password123", "Fallback", "Admin")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))

        def user = userRepository.findByEmail("fallback@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        user.isFallbackAdministrator = true
        user.setupCompleted = false
        userRepository.update(user)

        def loginRequest = new LoginRequest("fallback@example.com", "password123")
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

    def "POST /setup/complete should mark setup as completed for fallback admin"() {
        given: "a fallback admin token"
        String token = createFallbackAdminToken()

        when: "completing setup"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "")
                        .bearerAuth(token),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "setupCompleted is true"
        response.body().setupCompleted == true
        response.body().isFallbackAdministrator == true
    }

    def "POST /setup/complete should return 403 for regular user"() {
        given: "a regular user token"
        String token = createRegularUserToken()

        when: "attempting to complete setup"
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "")
                        .bearerAuth(token),
                UserResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "POST /setup/complete should return 403 if already completed"() {
        given: "a fallback admin who already completed setup"
        String token = createFallbackAdminToken()

        // Complete setup first
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "")
                        .bearerAuth(token),
                UserResponse
        )

        when: "attempting to complete setup again"
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "")
                        .bearerAuth(token),
                UserResponse
        )

        then: "forbidden exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.FORBIDDEN
    }

    def "POST /setup/complete should return 401 without token"() {
        when: "attempting to complete setup without authentication"
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", ""),
                UserResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }
}
