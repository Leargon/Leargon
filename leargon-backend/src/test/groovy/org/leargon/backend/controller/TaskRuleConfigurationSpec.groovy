package org.leargon.backend.controller

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.http.client.exceptions.HttpClientResponseException
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TaskDismissalRepository
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * The to-do rule catalogue is configurable so an organisation early in its governance journey can run
 * a short list and grow into the rest. These specs pin that behaviour: what runs by default, what
 * switching a rule off or downgrading it does, and who is allowed to change it.
 */
@MicronautTest(transactional = false)
class TaskRuleConfigurationSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject TaskDismissalRepository taskDismissalRepository
    @Inject TaskRuleConfigurationRepository taskRuleConfigurationRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
        cleanupData()
    }

    def cleanup() {
        cleanupData()
    }

    private void cleanupData() {
        taskDismissalRepository.deleteAll()
        taskRuleConfigurationRepository.deleteAll()
        fieldConfigurationRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private String createUserToken(String email, String username, String roles) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        resp.body().accessToken
    }

    private String createAdminToken(String email = "admin@rules.com", String username = "rulesAdmin") {
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Admin", "User")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login", [email: email, password: "password123"]), Map)
            .body().accessToken
    }

    private String createEntity(String token, String name) {
        def req = new CreateBusinessEntityRequest([new LocalizedText("en", name)])
        client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", req).bearerAuth(token), Map).body().key
    }

    private void makeDescriptionMandatory(String adminToken) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/field-configurations", [
                [entityType: "BUSINESS_ENTITY", fieldName: "descriptions.en",
                 visibility: "SHOWN", section: "CORE", maturityLevel: "BASIC"]
            ]).bearerAuth(adminToken), Argument.listOf(Map))
    }

    private List putRules(String token, List entries) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/task-rules", entries).bearerAuth(token), Argument.listOf(Map)).body()
    }

    private List getTasks(String token) {
        client.toBlocking().exchange(HttpRequest.GET("/tasks").bearerAuth(token), Map).body().tasks
    }

    // ─── definitions ───────────────────────────────────────────────────────────

    def "the rule inventory is readable and marks only the basic tier as on by default"() {
        given:
        String token = createUserToken("reader@rules.com", "rulesReader", "ROLE_USER")

        when:
        def defs = client.toBlocking().exchange(
            HttpRequest.GET("/administration/task-rules/definitions").bearerAuth(token), Argument.listOf(Map)).body()

        then:
        defs.size() > 5
        defs.every { it.ruleCode && it.label && it.description && it.maturityLevel && it.defaultPriority }
        defs.every { it.enabledByDefault == (it.maturityLevel == "BASIC") }
        defs.any { it.ruleCode == "MISSING_MANDATORY_FIELD" }
    }

    def "rules of a disabled methodology disappear from the inventory"() {
        given:
        String adminToken = createAdminToken("adminMeth@rules.com", "rulesAdminMeth")
        def current = client.toBlocking().exchange(
            HttpRequest.GET("/administration/methodology-configurations").bearerAuth(adminToken), Argument.listOf(Map)).body()
        def updated = current.collect { entry ->
            [key: entry.key, enabled: entry.key == "GDPR" ? false : entry.enabled,
             verificationEnabled: entry.verificationEnabled]
        }

        when:
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/methodology-configurations", updated).bearerAuth(adminToken), Argument.listOf(Map))
        def defs = client.toBlocking().exchange(
            HttpRequest.GET("/administration/task-rules/definitions").bearerAuth(adminToken), Argument.listOf(Map)).body()

        then:
        defs.every { it.ruleCode != "NO_LEGAL_BASIS" }

        cleanup:
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/methodology-configurations", current).bearerAuth(adminToken), Argument.listOf(Map))
    }

    // ─── defaults ──────────────────────────────────────────────────────────────

    def "with no configuration only basic-tier rules run"() {
        given:
        String adminToken = createAdminToken("adminDefaults@rules.com", "rulesAdminDefaults")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner@rules.com", "rulesOwner",
            "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        createEntity(ownerToken, "DefaultTierEntity")

        when:
        def tasks = getTasks(ownerToken)

        then: "the basic mandatory-field rule fires"
        tasks.any { it.ruleCode == "MISSING_MANDATORY_FIELD" }

        and: "the advanced ones stay quiet until the organisation opts in"
        tasks.every { it.ruleCode != "MISSING_STEWARD" }
        tasks.every { it.ruleCode != "ENTITY_NO_BOUNDED_CONTEXT" }
    }

    def "enabling an advanced rule adds its to-dos"() {
        given:
        String adminToken = createAdminToken("adminEnable@rules.com", "rulesAdminEnable")
        String ownerToken = createUserToken("ownerEnable@rules.com", "rulesOwnerEnable",
            "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        createEntity(ownerToken, "StewardlessEntity")

        when:
        putRules(adminToken, [[ruleCode: "MISSING_STEWARD", enabled: true]])

        then:
        getTasks(ownerToken).any { it.ruleCode == "MISSING_STEWARD" }
    }

    def "switching a rule off removes exactly its to-dos"() {
        given:
        String adminToken = createAdminToken("adminOff@rules.com", "rulesAdminOff")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("ownerOff@rules.com", "rulesOwnerOff",
            "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        createEntity(ownerToken, "QuietEntity")
        assert getTasks(ownerToken).any { it.ruleCode == "MISSING_MANDATORY_FIELD" }

        when:
        putRules(adminToken, [
            [ruleCode: "MISSING_MANDATORY_FIELD", enabled: false],
            [ruleCode: "MISSING_STEWARD", enabled: true]
        ])

        then:
        def tasks = getTasks(ownerToken)
        tasks.every { it.ruleCode != "MISSING_MANDATORY_FIELD" }
        tasks.any { it.ruleCode == "MISSING_STEWARD" }
    }

    def "downgrading a rule keeps the to-do but moves it to could-do"() {
        given:
        String adminToken = createAdminToken("adminDown@rules.com", "rulesAdminDown")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("ownerDown@rules.com", "rulesOwnerDown",
            "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE")
        createEntity(ownerToken, "DowngradedEntity")
        assert getTasks(ownerToken).find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.priority == "REQUIRED"

        when:
        putRules(adminToken, [[ruleCode: "MISSING_MANDATORY_FIELD", enabled: true, priority: "RECOMMENDED"]])

        then:
        getTasks(ownerToken).find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.priority == "RECOMMENDED"
    }

    def "the saved configuration is readable back"() {
        given:
        String adminToken = createAdminToken("adminRead@rules.com", "rulesAdminRead")

        when:
        putRules(adminToken, [[ruleCode: "MISSING_STEWARD", enabled: true, priority: "REQUIRED"]])
        def saved = client.toBlocking().exchange(
            HttpRequest.GET("/administration/task-rules").bearerAuth(adminToken), Argument.listOf(Map)).body()

        then:
        saved.size() == 1
        saved[0].ruleCode == "MISSING_STEWARD"
        saved[0].enabled == true
        saved[0].priority == "REQUIRED"
    }

    // ─── permissions ───────────────────────────────────────────────────────────

    def "a plain user cannot change the rule configuration"() {
        given:
        String token = createUserToken("plain@rules.com", "rulesPlain", "ROLE_USER")

        when:
        putRules(token, [[ruleCode: "MISSING_STEWARD", enabled: true]])

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "a methodology lead may change only the rules of their own methodology"() {
        given:
        String leadToken = createUserToken("lead@rules.com", "rulesLead", "ROLE_USER,ROLE_LEAD_GDPR")

        when: "changing a GDPR rule"
        def saved = putRules(leadToken, [[ruleCode: "DPIA_RECOMMENDED", enabled: true]])

        then:
        saved.any { it.ruleCode == "DPIA_RECOMMENDED" }

        when: "reaching for a rule outside their methodology"
        putRules(leadToken, [[ruleCode: "ENTITY_NO_BOUNDED_CONTEXT", enabled: true]])

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "an unknown rule code is rejected"() {
        given:
        String adminToken = createAdminToken("adminUnknown@rules.com", "rulesAdminUnknown")

        when:
        putRules(adminToken, [[ruleCode: "NOT_A_RULE", enabled: true]])

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }
}
