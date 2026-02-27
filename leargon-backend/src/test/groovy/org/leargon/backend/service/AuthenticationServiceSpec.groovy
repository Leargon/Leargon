package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class AuthenticationServiceSpec extends Specification {

    @Inject
    UserRepository userRepository

    @Inject
    UserService userService

    @Inject
    AuthenticationService authenticationService

    def cleanup() {
        userRepository.deleteAll()
    }

    def "should authenticate user with valid credentials"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("auth@example.com", "authuser", "password123", "Auth", "User")
        userService.createUser(signupRequest)

        and: "valid login credentials"
        def loginRequest = new LoginRequest("auth@example.com", "password123")

        when: "authenticating the user"
        def user = authenticationService.authenticate(loginRequest)

        then: "authentication succeeds"
        user != null
        user.email == "auth@example.com"
        user.username == "authuser"
        user.firstName == "Auth"
        user.lastName == "User"
    }

    def "should throw exception with invalid email"() {
        given: "login request with non-existent email"
        def loginRequest = new LoginRequest("nonexistent@example.com", "password123")

        when: "attempting to authenticate"
        authenticationService.authenticate(loginRequest)

        then: "AuthenticationException is thrown"
        def exception = thrown(AuthenticationException)
        exception.message == "Invalid email or password"
    }

    def "should throw exception with invalid password"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("wrongpass@example.com", "wrongpass", "correctpassword", "Wrong", "Pass")
        userService.createUser(signupRequest)

        and: "login request with wrong password"
        def loginRequest = new LoginRequest("wrongpass@example.com", "wrongpassword")

        when: "attempting to authenticate"
        authenticationService.authenticate(loginRequest)

        then: "AuthenticationException is thrown"
        def exception = thrown(AuthenticationException)
        exception.message == "Invalid email or password"
    }

    def "should throw exception when account is disabled"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("disabled@example.com", "disabled", "password123", "Disabled", "User")
        def user = userService.createUser(signupRequest)

        and: "user account is disabled"
        user.enabled = false
        userRepository.update(user)

        and: "valid login credentials"
        def loginRequest = new LoginRequest("disabled@example.com", "password123")

        when: "attempting to authenticate"
        authenticationService.authenticate(loginRequest)

        then: "AuthenticationException is thrown"
        def exception = thrown(AuthenticationException)
        exception.message == "Account is disabled"
    }

    def "should authenticate multiple users independently"() {
        given: "multiple registered users"
        def users = [
                new SignupRequest("user1@test.com", "user1", "password1", "User", "One"),
                new SignupRequest("user2@test.com", "user2", "password2", "User", "Two"),
                new SignupRequest("user3@test.com", "user3", "password3", "User", "Three")
        ]
        users.each { userService.createUser(it) }

        expect: "each user can authenticate with their own credentials"
        def loginRequest1 = new LoginRequest("user1@test.com", "password1")
        def user1 = authenticationService.authenticate(loginRequest1)
        user1.email == "user1@test.com"

        def loginRequest2 = new LoginRequest("user2@test.com", "password2")
        def user2 = authenticationService.authenticate(loginRequest2)
        user2.email == "user2@test.com"

        def loginRequest3 = new LoginRequest("user3@test.com", "password3")
        def user3 = authenticationService.authenticate(loginRequest3)
        user3.email == "user3@test.com"
    }

    def "should not authenticate user with wrong password case"() {
        given: "a registered user"
        def signupRequest = new SignupRequest("case@example.com", "caseuser", "Password123", "Case", "User")
        userService.createUser(signupRequest)

        and: "login request with wrong case password"
        def loginRequest = new LoginRequest("case@example.com", "password123")

        when: "attempting to authenticate"
        authenticationService.authenticate(loginRequest)

        then: "AuthenticationException is thrown"
        thrown(AuthenticationException)
    }
}
