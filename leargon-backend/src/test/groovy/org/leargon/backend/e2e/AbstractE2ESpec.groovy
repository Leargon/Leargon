package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import io.micronaut.test.support.TestPropertyProvider
import jakarta.inject.Inject
import org.leargon.backend.repository.UserRepository
import org.testcontainers.mysql.MySQLContainer
import spock.lang.Shared
import spock.lang.Specification

@MicronautTest(transactional = false, environments = ["e2e"])
abstract class AbstractE2ESpec extends Specification implements TestPropertyProvider {

    @Shared
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4")
            .withDatabaseName("leargon")
            .withUsername("leargon")
            .withPassword("leargon")

    static {
        mysql.start()
    }

    @Inject
    @Client("/")
    HttpClient client

    @Inject
    UserRepository userRepository

    @Override
    Map<String, String> getProperties() {
        return [
                'datasources.default.url'     : mysql.jdbcUrl,
                'datasources.default.username' : mysql.username,
                'datasources.default.password' : mysql.password,
        ]
    }

    /** Sign up a new user and return the access token. */
    protected String signup(String email, String username, String password = "password123",
                            String firstName = "Test", String lastName = "User") {
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", [
                        email    : email,
                        username : username,
                        password : password,
                        firstName: firstName,
                        lastName : lastName
                ]),
                Map
        )
        return response.body().accessToken
    }

    /** Login an existing user and return the access token. */
    protected String login(String email, String password = "password123") {
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/login", [
                        email   : email,
                        password: password
                ]),
                Map
        )
        return response.body().accessToken
    }

    /** Sign up a user, promote to admin via DB, re-login, return admin token. */
    protected String signupAdmin(String email, String username) {
        signup(email, username)
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        return login(email)
    }

    /** Create a business entity and return the response body as Map. */
    protected Map createEntity(String token, String name, Map extras = [:]) {
        def body = [names: [[locale: "en", text: name]]] + extras
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", body).bearerAuth(token),
                Map
        )
        return response.body()
    }

    /** Create a business domain and return the response body as Map. */
    protected Map createDomain(String token, String name, Map extras = [:]) {
        def body = [names: [[locale: "en", text: name]]] + extras
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", body).bearerAuth(token),
                Map
        )
        return response.body()
    }

    /** Create a process and return the response body as Map. */
    protected Map createProcess(String token, String name, Map extras = [:]) {
        def body = [names: [[locale: "en", text: name]]] + extras
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", body).bearerAuth(token),
                Map
        )
        return response.body()
    }

    /** Create a classification and return the response body as Map. */
    protected Map createClassification(String token, String name, String assignableTo = "BUSINESS_ENTITY",
                                       List<Map> values = []) {
        def body = [
                names       : [[locale: "en", text: name]],
                assignableTo: assignableTo,
                optional    : true,
                values      : values
        ]
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications", body).bearerAuth(token),
                Map
        )
        return response.body()
    }
}
