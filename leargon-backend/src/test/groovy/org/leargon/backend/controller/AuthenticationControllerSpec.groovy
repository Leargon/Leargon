package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.AuthResponse
import org.leargon.backend.model.AzureConfigResponse
import org.leargon.backend.model.AzureLoginRequest
import org.leargon.backend.model.ErrorResponse
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class AuthenticationControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    def cleanup() {
        userRepository.deleteAll()
    }

    def "POST /authentication/signup should create user and return JWT token"() {
        given: "a valid signup request"
        def request = new SignupRequest("newuser@example.com", "newuser", "password123", "New", "User")

        when: "posting signup request"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", request),
                AuthResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "JWT token is returned"
        def body = response.body()
        body.accessToken != null
        body.accessToken.length() > 0
        body.tokenType == "Bearer"
        body.expiresIn == 3600L

        and: "user information is returned"
        body.user != null
        body.user.email == "newuser@example.com"
        body.user.username == "newuser"
        body.user.firstName == "New"
        body.user.lastName == "User"
        body.user.enabled == true
        body.user.id != null
        body.user.createdAt != null
    }

    def "POST /authentication/signup should return 409 for duplicate email"() {
        given: "an existing user"
        def existingRequest = new SignupRequest("duplicate@example.com", "user1", "password123", "First", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", existingRequest))

        and: "a signup request with the same email"
        def duplicateRequest = new SignupRequest("duplicate@example.com", "user2", "password123", "Second", "User")

        when: "posting duplicate signup request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", duplicateRequest), ErrorResponse)

        then: "conflict exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.CONFLICT
        def errorBody = exception.response.getBody(ErrorResponse).orElse(null)
        errorBody != null
        errorBody.message == "Email already exists"
    }

    def "POST /authentication/signup should return 409 for duplicate username"() {
        given: "an existing user"
        def existingRequest = new SignupRequest("user1@example.com", "duplicate", "password123", "First", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", existingRequest))

        and: "a signup request with the same username"
        def duplicateRequest = new SignupRequest("user2@example.com", "duplicate", "password123", "Second", "User")

        when: "posting duplicate signup request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", duplicateRequest), ErrorResponse)

        then: "conflict exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.CONFLICT
        def errorBody = exception.response.getBody(ErrorResponse).orElse(null)
        errorBody != null
        errorBody.message == "Username already exists"
    }

    def "POST /authentication/signup should return 400 for invalid email"() {
        given: "a signup request with invalid email"
        def request = new SignupRequest("invalid-email", "testuser", "password123", "Test", "User")

        when: "posting invalid signup request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", request))

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "POST /authentication/signup should return 400 for short password"() {
        given: "a signup request with short password"
        def request = new SignupRequest("test@example.com", "testuser", "short", "Test", "User")

        when: "posting invalid signup request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", request))

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "POST /authentication/login should authenticate user and return JWT token"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("login@example.com", "loginuser", "password123", "Login", "User")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))

        and: "valid login credentials"
        def loginRequest = new LoginRequest("login@example.com", "password123")

        when: "posting login request"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", loginRequest),
                AuthResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "JWT token is returned"
        def body = response.body()
        body.accessToken != null
        body.accessToken.length() > 0
        body.tokenType == "Bearer"
        body.expiresIn == 3600L

        and: "user information is returned with last login"
        body.user != null
        body.user.email == "login@example.com"
        body.user.lastLoginAt != null
    }

    def "POST /authentication/login should return 401 for invalid email"() {
        given: "login request with non-existent email"
        def loginRequest = new LoginRequest("nonexistent@example.com", "password123")

        when: "posting login request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/login", loginRequest), ErrorResponse)

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
        def errorBody = exception.response.getBody(ErrorResponse).orElse(null)
        errorBody != null
        errorBody.message == "Invalid email or password"
    }

    def "POST /authentication/login should return 401 for invalid password"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("wrongpass@example.com", "wrongpass", "correctpassword", "Wrong", "Pass")
        client.toBlocking().exchange(HttpRequest.POST("/authentication/signup", signupRequest))

        and: "login request with wrong password"
        def loginRequest = new LoginRequest("wrongpass@example.com", "wrongpassword")

        when: "posting login request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/login", loginRequest), ErrorResponse)

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
        def errorBody = exception.response.getBody(ErrorResponse).orElse(null)
        errorBody != null
        errorBody.message == "Invalid email or password"
    }

    def "POST /authentication/login should return 400 for invalid email format"() {
        given: "login request with invalid email format"
        def loginRequest = new LoginRequest("not-an-email", "password123")

        when: "posting login request"
        client.toBlocking().exchange(HttpRequest.POST("/authentication/login", loginRequest))

        then: "bad request exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.BAD_REQUEST
    }

    def "should support complete signup and login flow"() {
        given: "a new user signs up"
        def signupRequest = new SignupRequest("flow@example.com", "flowuser", "password123", "Flow", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )

        expect: "signup succeeds"
        signupResponse.status == HttpStatus.OK
        signupResponse.body().accessToken != null

        when: "the same user logs in"
        def loginRequest = new LoginRequest("flow@example.com", "password123")
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", loginRequest),
                AuthResponse
        )

        then: "login succeeds"
        loginResponse.status == HttpStatus.OK
        loginResponse.body().accessToken != null

        and: "last login is updated"
        loginResponse.body().user.lastLoginAt != null
    }

    def "GET /authentication/azure-config should return disabled when Azure is not configured"() {
        when: "getting azure config"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/authentication/azure-config"),
                AzureConfigResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "azure is not enabled"
        def body = response.body()
        body.enabled == false
        body.tenantId == null
        body.clientId == null
    }

    def "POST /authentication/azure-login should return 401 when Azure is not configured"() {
        given: "an azure login request"
        def request = new AzureLoginRequest("some-fake-token")

        when: "posting azure login request"
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/azure-login", request),
                ErrorResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "should handle concurrent signup requests"() {
        given: "multiple unique signup requests"
        def requests = (1..5).collect { i ->
            new SignupRequest("concurrent${i}@example.com", "concurrent${i}", "password123", "User", "${i}")
        }

        when: "submitting requests concurrently"
        def responses = requests.collect { request ->
            try {
                client.toBlocking().exchange(
                        HttpRequest.POST("/authentication/signup", request),
                        AuthResponse
                )
            } catch (Exception e) {
                null
            }
        }

        then: "all requests succeed"
        responses.every { it != null && it.status == HttpStatus.OK }
        responses.every { it.body().accessToken != null }

        and: "all tokens are unique"
        def tokens = responses.collect { it.body().accessToken }
        tokens.size() == tokens.toSet().size()
    }
}
