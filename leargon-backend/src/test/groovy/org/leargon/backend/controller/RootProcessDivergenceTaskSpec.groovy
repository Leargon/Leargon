package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ItemCreationRecordRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * "Processing activity may be drawn too coarse": a root process handling personal data whose sub-processes
 * use different legal bases (or whose direct sub-processes state different purposes) gets a nudge to split.
 */
@MicronautTest(transactional = false)
class RootProcessDivergenceTaskSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject TaskRuleConfigurationRepository taskRuleConfigurationRepository
    @Inject ItemCreationRecordRepository itemCreationRecordRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository

    def setup() {
        if (localeRepository.findByLocaleCode("en").isEmpty()) {
            localeRepository.save(new SupportedLocale(localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        taskRuleConfigurationRepository.deleteAll()
        itemCreationRecordRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        userRepository.deleteAll()
    }

    private String adminToken() {
        def resp = client.toBlocking().exchange(
                HttpRequest.POST("/authentication/signup", new SignupRequest("rpd-admin@test.com", "rpdadmin", "password123", "Test", "User")), Map)
        def u = userRepository.findByEmail("rpd-admin@test.com").get()
        u.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(u)
        return resp.body().accessToken
    }

    private Map post(String path, Object body, String token) {
        client.toBlocking().exchange(HttpRequest.POST(path, body).bearerAuth(token), Map).body()
    }

    private static List names(String text) { [[locale: "en", text: text]] }

    private boolean nudged(String token, String processKey) {
        def tasks = client.toBlocking().exchange(HttpRequest.GET("/tasks").bearerAuth(token), Map).body().tasks as List<Map>
        tasks.any { it.resourceKey == processKey && it.ruleCode == "ROOT_PROCESS_DIVERGENT_PURPOSES" }
    }

    /** A root process (with personal data flowing through a sub-process) and two sub-processes. */
    private Map fixture(String firstBasis, String secondBasis, boolean personalData = true) {
        def admin = adminToken()
        client.toBlocking().exchange(HttpRequest.PUT("/administration/task-rules",
                [[ruleCode: "ROOT_PROCESS_DIVERGENT_PURPOSES", enabled: true]]).bearerAuth(admin))
        def customer = post("/business-entities", [names: names("Customer"), containsPersonalData: personalData], admin).key
        def root = post("/processes", [names: names("Customer Management")], admin).key
        post("/processes", [names: names("Onboarding"), parentProcessKey: root, legalBasis: firstBasis, inputEntityKeys: [customer]], admin)
        post("/processes", [names: names("Newsletter"), parentProcessKey: root, legalBasis: secondBasis], admin)
        [admin: admin, root: root]
    }

    def "a root whose sub-processes use different legal bases is nudged"() {
        given:
        def f = fixture("CONTRACT", "CONSENT")

        expect:
        nudged(f.admin, f.root)
    }

    def "a root whose sub-processes share one legal basis is not nudged"() {
        given:
        def f = fixture("CONTRACT", "CONTRACT")

        expect:
        !nudged(f.admin, f.root)
    }

    def "a root without personal data is not nudged"() {
        given:
        def f = fixture("CONTRACT", "CONSENT", false)

        expect:
        !nudged(f.admin, f.root)
    }

    def "sub-processes are never nudged themselves"() {
        given:
        def f = fixture("CONTRACT", "CONSENT")
        def child = processRepository.findAll().find { it.parent != null }

        expect:
        !nudged(f.admin, child.key)
    }
}
