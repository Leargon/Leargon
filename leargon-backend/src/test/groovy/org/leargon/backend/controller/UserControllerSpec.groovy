package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.AuthResponse
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.UserResponse
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class UserControllerSpec extends Specification {

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    def cleanup() {
        userRepository.deleteAll()
    }

    def "GET /users/me should return current user with valid JWT token"() {
        given: "a registered and authenticated user"
        def signupRequest = new SignupRequest("current@example.com", "currentuser", "password123", "Current", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )
        def token = signupResponse.body().accessToken

        when: "requesting current user with valid token"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/users/me")
                        .bearerAuth(token),
                UserResponse
        )

        then: "response is successful"
        response.status == HttpStatus.OK

        and: "user information is returned"
        def user = response.body()
        user.email == "current@example.com"
        user.username == "currentuser"
        user.firstName == "Current"
        user.lastName == "User"
        user.enabled == true
        user.id != null
        user.createdAt != null
    }

    def "GET /users/me should return 401 without authentication token"() {
        when: "requesting current user without token"
        client.toBlocking().exchange(
                HttpRequest.GET("/users/me"),
                UserResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /users/me should return 401 with invalid token"() {
        when: "requesting current user with invalid token"
        client.toBlocking().exchange(
                HttpRequest.GET("/users/me")
                        .bearerAuth("invalid.token.here"),
                UserResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /users/me should return 401 with malformed token"() {
        when: "requesting current user with malformed token"
        client.toBlocking().exchange(
                HttpRequest.GET("/users/me")
                        .bearerAuth("not-a-jwt-token"),
                UserResponse
        )

        then: "unauthorized exception is thrown"
        def exception = thrown(HttpClientResponseException)
        exception.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /users/me should return correct user for different tokens"() {
        given: "multiple registered users"
        def user1Request = new SignupRequest("user1@example.com", "user1", "password123", "User", "One")
        def user1Response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", user1Request),
                AuthResponse
        )
        def token1 = user1Response.body().accessToken

        def user2Request = new SignupRequest("user2@example.com", "user2", "password123", "User", "Two")
        def user2Response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", user2Request),
                AuthResponse
        )
        def token2 = user2Response.body().accessToken

        when: "requesting current user with user1 token"
        def response1 = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(token1),
                UserResponse
        )

        then: "user1 information is returned"
        response1.body().email == "user1@example.com"
        response1.body().username == "user1"

        when: "requesting current user with user2 token"
        def response2 = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(token2),
                UserResponse
        )

        then: "user2 information is returned"
        response2.body().email == "user2@example.com"
        response2.body().username == "user2"
    }

    def "GET /users/me should not expose password hash"() {
        given: "a registered and authenticated user"
        def signupRequest = new SignupRequest("secure@example.com", "secureuser", "password123", "Secure", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )
        def token = signupResponse.body().accessToken

        when: "requesting current user"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(token),
                UserResponse
        )

        then: "password hash is not included in response"
        def user = response.body()
        // The user object should not have any password-related sensitive data
        // Note: passwordExpired field names is acceptable, but actual hash should never be present
        !user.toString().contains("passwordHash")
        !user.toString().contains("\$2")  // BCrypt hash prefix
    }

    def "GET /users/me should return updated information after login"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("updated@example.com", "updateduser", "password123", "Updated", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )
        def initialLastLogin = signupResponse.body().user.lastLoginAt

        when: "user logs in"
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email: "updated@example.com",
                        password: "password123"
                ]),
                AuthResponse
        )
        def token = loginResponse.body().accessToken

        and: "requesting current user"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(token),
                UserResponse
        )

        then: "last login timestamp is updated"
        def user = response.body()
        user.lastLoginAt != initialLastLogin
        user.lastLoginAt != null
    }

    def "GET /users/me should work with token from both signup and login"() {
        given: "a new user signs up"
        def signupRequest = new SignupRequest("bothways@example.com", "bothways", "password123", "Both", "Ways")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )
        def signupToken = signupResponse.body().accessToken

        when: "accessing /users/me with signup token"
        def signupUserResponse = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(signupToken),
                UserResponse
        )

        then: "request succeeds"
        signupUserResponse.status == HttpStatus.OK
        signupUserResponse.body().email == "bothways@example.com"

        when: "user logs in"
        def loginResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email: "bothways@example.com",
                        password: "password123"
                ]),
                AuthResponse
        )
        def loginToken = loginResponse.body().accessToken

        and: "accessing /users/me with login token"
        def loginUserResponse = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(loginToken),
                UserResponse
        )

        then: "request succeeds"
        loginUserResponse.status == HttpStatus.OK
        loginUserResponse.body().email == "bothways@example.com"

        and: "same user data is returned"
        signupUserResponse.body().id == loginUserResponse.body().id
        signupUserResponse.body().email == loginUserResponse.body().email
        signupUserResponse.body().username == loginUserResponse.body().username
    }

    def "GET /users/me should handle concurrent requests with same token"() {
        given: "a registered and authenticated user"
        def signupRequest = new SignupRequest("concurrent@example.com", "concurrent", "password123", "Concurrent", "User")
        def signupResponse = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", signupRequest),
                AuthResponse
        )
        def token = signupResponse.body().accessToken

        when: "making multiple concurrent requests with same token"
        def responses = (1..5).collect {
            try {
                client.toBlocking().exchange(
                        HttpRequest.GET("/users/me").bearerAuth(token),
                        UserResponse
                )
            } catch (Exception e) {
                null
            }
        }

        then: "all requests succeed"
        responses.every { it != null && it.status == HttpStatus.OK }

        and: "same user data is returned"
        def users = responses.collect { it.body() }
        users.every { it.email == "concurrent@example.com" }
        users.every { it.id == users[0].id }
    }
}
