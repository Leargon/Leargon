package org.leargon.backend.e2e

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class AuthenticationE2ESpec extends AbstractE2ESpec {

    // =====================
    // SIGNUP
    // =====================

    def "should sign up a new user and return token"() {
        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", [
                        email    : "auth-signup@example.com",
                        username : "authsignup",
                        password : "password123",
                        firstName: "Auth",
                        lastName : "Signup"
                ]),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().accessToken != null
        response.body().accessToken.length() > 0
        response.body().user != null
        response.body().user.email == "auth-signup@example.com"
        response.body().user.username == "authsignup"
        response.body().user.firstName == "Auth"
        response.body().user.lastName == "Signup"
    }

    def "should reject signup with duplicate email"() {
        given:
        signup("auth-dupe-email@example.com", "dupetest1")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", [
                        email    : "auth-dupe-email@example.com",
                        username : "dupetest2",
                        password : "password123",
                        firstName: "Dupe",
                        lastName : "Test"
                ]),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "should reject signup with duplicate username"() {
        given:
        signup("auth-dupe-user1@example.com", "dupeusername")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", [
                        email    : "auth-dupe-user2@example.com",
                        username : "dupeusername",
                        password : "password123",
                        firstName: "Dupe",
                        lastName : "User"
                ]),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // LOGIN
    // =====================

    def "should login with valid credentials"() {
        given:
        signup("auth-login@example.com", "authlogin")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email   : "auth-login@example.com",
                        password: "password123"
                ]),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().accessToken != null
    }

    def "should reject login with wrong password"() {
        given:
        signup("auth-wrongpw@example.com", "authwrongpw")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email   : "auth-wrongpw@example.com",
                        password: "wrongpassword"
                ]),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    def "should reject login for non-existent user"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email   : "nonexistent@example.com",
                        password: "password123"
                ]),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // TOKEN VALIDATION
    // =====================

    def "should reject unauthenticated access to protected endpoints"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/business-entities"), Map)

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    def "should reject access with invalid token"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth("invalid.token.value"),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // USER PROFILE
    // =====================

    def "should return current user profile via /users/me"() {
        given:
        def token = signup("auth-me@example.com", "authme", "password123", "My", "Profile")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/users/me").bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().email == "auth-me@example.com"
        response.body().username == "authme"
        response.body().firstName == "My"
        response.body().lastName == "Profile"
        response.body().enabled == true
    }

    // =====================
    // PASSWORD CHANGE
    // =====================

    def "should change own password"() {
        given:
        def token = signup("auth-pwchange@example.com", "authpwchange")

        when: "changing password"
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/users/me/password", [
                        currentPassword: "password123",
                        newPassword    : "newpassword456"
                ]).bearerAuth(token)
        )

        then:
        response.status == HttpStatus.OK

        when: "logging in with new password"
        def newToken = login("auth-pwchange@example.com", "newpassword456")

        then:
        newToken != null
    }

    def "should reject password change with wrong current password"() {
        given:
        def token = signup("auth-pwwrong@example.com", "authpwwrong")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/users/me/password", [
                        currentPassword: "wrongcurrentpw",
                        newPassword    : "newpassword456"
                ]).bearerAuth(token)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // AZURE CONFIG
    // =====================

    def "should return Azure configuration status"() {
        given:
        def token = signup("auth-azure@example.com", "authazure")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/authentication/azure-config").bearerAuth(token),
                Map
        )

        then: "Azure is not configured in test environment"
        response.status == HttpStatus.OK
        response.body().enabled == false
    }
}
