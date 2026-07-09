package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class ProcessingRegisterControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String token(String email = "reg@test.com", String username = "regadmin") {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup", new SignupRequest(email, username, "password123", "A", "U")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login", [email: email, password: "password123"]), Map).body().accessToken
    }

    private String createProcess(String token, String name, String parentKey = null) {
        def req = [names: [[locale: "en", text: name]]]
        if (parentKey != null) req.parentProcessKey = parentKey
        client.toBlocking().exchange(HttpRequest.POST("/processes", req).bearerAuth(token), Map).body().key
    }

    private String createEntity(String token, String name, boolean pii, String role) {
        String key = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", [names: [[locale: "en", text: name]]]).bearerAuth(token), Map).body().key
        // Stamp the typed GDPR fields directly (fast, avoids extra round-trips)
        def e = businessEntityRepository.findByKey(key).get()
        e.containsPersonalData = pii
        e.entityRole = role
        businessEntityRepository.update(e)
        key
    }

    def "register emits one rolled-up row per root process and splits data subjects vs data categories"() {
        given: "a parent process with a child, and personal-data entities linked to the child"
        String adminToken = token()
        String parentKey = createProcess(adminToken, "Recruitment")
        String childKey = createProcess(adminToken, "Screen Candidate", parentKey)
        String person = createEntity(adminToken, "Candidate", true, "DATA_SUBJECT")
        String data = createEntity(adminToken, "CV Document", true, "DATA_ATTRIBUTE")
        client.toBlocking().exchange(HttpRequest.POST("/processes/${childKey}/inputs", [entityKey: person]).bearerAuth(adminToken), Map)
        client.toBlocking().exchange(HttpRequest.POST("/processes/${childKey}/inputs", [entityKey: data]).bearerAuth(adminToken), Map)

        when: "reading the processing register"
        def resp = client.toBlocking().exchange(
            HttpRequest.GET("/processing-register").bearerAuth(adminToken), Argument.listOf(Map))
        def rows = resp.body()

        then: "there is exactly one row — the root — and the child is not a separate row (B3)"
        resp.status == HttpStatus.OK
        rows.size() == 1
        def row = rows[0]
        row.key == parentKey
        row.hasChildren == true

        and: "the child's entities roll up into the root row, split by entity role (B2)"
        row.personCategories.contains("Candidate")
        !row.personCategories.contains("CV Document")
        row.dataCategories.contains("CV Document")
        !row.dataCategories.contains("Candidate")
    }
}
