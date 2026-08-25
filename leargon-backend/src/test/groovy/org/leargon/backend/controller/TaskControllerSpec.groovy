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
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TaskDismissalRepository
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Covers the owner to-do list end to end: who sees which task, the deep-link payload, dismissal with
 * its auto-revive, and the admin by-owner aggregate.
 */
@MicronautTest(transactional = false)
class TaskControllerSpec extends Specification {

    @Inject @Client("/") HttpClient client
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository businessEntityRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject OrganisationalUnitRepository organisationalUnitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject FieldVerificationRepository fieldVerificationRepository
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
        fieldVerificationRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        businessEntityVersionRepository.deleteAll()
        businessEntityRepository.deleteAll()
        organisationalUnitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private static final String EDITOR_ROLES =
        "ROLE_USER,ROLE_EDITOR_DATA_GOVERNANCE,ROLE_EDITOR_PROCESS_GOVERNANCE,ROLE_EDITOR_GDPR," +
        "ROLE_EDITOR_DDD,ROLE_EDITOR_BCM,ROLE_EDITOR_TEAM_TOPOLOGIES"

    private String createUserToken(String email, String username, String roles = EDITOR_ROLES) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Test", "User")), Map)
        def user = userRepository.findByEmail(email).get()
        user.roles = roles
        userRepository.update(user)
        resp.body().accessToken
    }

    private String createAdminToken(String email = "admin@tasks.com", String username = "tasksAdmin") {
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

    /** Makes the English description of every business entity mandatory, which is the gap the tests use. */
    private void makeDescriptionMandatory(String adminToken) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/administration/field-configurations", [
                [entityType: "BUSINESS_ENTITY", fieldName: "descriptions.en",
                 visibility: "SHOWN", section: "CORE", maturityLevel: "BASIC"]
            ]).bearerAuth(adminToken), Argument.listOf(Map))
    }

    private Map getTasks(String token, boolean includeDismissed = false) {
        client.toBlocking().exchange(
            HttpRequest.GET("/tasks?includeDismissed=${includeDismissed}").bearerAuth(token), Map).body()
    }

    // ─── auth guards ───────────────────────────────────────────────────────────

    def "GET /tasks returns 401 without authentication"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/tasks"), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /tasks/by-owner returns 403 for a non-admin"() {
        given:
        String token = createUserToken("plain@tasks.com", "plainTaskUser")

        when:
        client.toBlocking().exchange(HttpRequest.GET("/tasks/by-owner").bearerAuth(token), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    // ─── derivation ────────────────────────────────────────────────────────────

    def "a new user with nothing to own has an empty list and a null completion percentage"() {
        given:
        String token = createUserToken("empty@tasks.com", "emptyTaskUser")

        when:
        def body = getTasks(token)

        then:
        body.tasks == []
        body.summary.open == 0
        body.summary.checksEvaluated == 0
        body.summary.completionPercentage == null
    }

    def "the owner sees a to-do for a mandatory field that has no value"() {
        given:
        String adminToken = createAdminToken()
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner@tasks.com", "taskOwner")
        createEntity(ownerToken, "Customer")

        when:
        def body = getTasks(ownerToken)

        then:
        def task = body.tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }
        task != null
        task.resourceType == "ENTITY"
        task.fieldName == "descriptions.en"
        // The list names the field the way the detail panel does, not by its storage key.
        task.fieldLabels.find { it.locale == "en" }.text == "Description (en)"
        task.priority == "REQUIRED"
        task.responsibility == "OWNER"
        task.dismissed == false
        // Names come back localised so the frontend renders them in the display locale.
        task.resourceNames.any { it.locale == "en" && it.text == "Customer" }
    }

    def "a user who neither owns nor stewards the item sees nothing"() {
        given:
        String adminToken = createAdminToken("admin2@tasks.com", "tasksAdmin2")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner2@tasks.com", "taskOwner2")
        createEntity(ownerToken, "PrivateEntity")
        String strangerToken = createUserToken("stranger@tasks.com", "taskStranger")

        when:
        def body = getTasks(strangerToken)

        then:
        body.tasks.every { it.resourceKey != "privateentity" }
        body.tasks.findAll { it.ruleCode == "MISSING_MANDATORY_FIELD" }.isEmpty()
    }

    def "the steward of an item sees its to-dos too"() {
        given:
        String adminToken = createAdminToken("admin3@tasks.com", "tasksAdmin3")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner3@tasks.com", "taskOwner3")
        String stewardToken = createUserToken("steward@tasks.com", "taskSteward")
        def key = createEntity(ownerToken, "SharedEntity")
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${key}/data-steward", [dataStewardUsername: "taskSteward"])
                .bearerAuth(ownerToken), Map)

        when:
        def body = getTasks(stewardToken)

        then:
        def task = body.tasks.find { it.resourceKey == key }
        task != null
        task.responsibility == "STEWARD"
    }

    def "the summary counts every check that ran, not only the failing ones"() {
        given:
        String adminToken = createAdminToken("admin4@tasks.com", "tasksAdmin4")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner4@tasks.com", "taskOwner4")
        createEntity(ownerToken, "MeasuredEntity")

        when:
        def summary = getTasks(ownerToken).summary

        then:
        summary.checksEvaluated > summary.open
        summary.checksPassed == summary.checksEvaluated - summary.open
        summary.completionPercentage != null
        summary.completionPercentage < 100
    }

    // ─── dismissal ─────────────────────────────────────────────────────────────

    def "dismissing a to-do with a reason removes it from the list"() {
        given:
        String adminToken = createAdminToken("admin5@tasks.com", "tasksAdmin5")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner5@tasks.com", "taskOwner5")
        createEntity(ownerToken, "DismissibleEntity")
        def taskId = getTasks(ownerToken).tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.id

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/tasks/${taskId}/dismissal", [reason: "Not applicable to this entity"])
                .bearerAuth(ownerToken), Map)

        then:
        resp.status == HttpStatus.OK
        resp.body().dismissed == true

        and: "it is gone from the default list but visible when explicitly requested"
        getTasks(ownerToken).tasks.every { it.id != taskId }
        def withDismissed = getTasks(ownerToken, true).tasks.find { it.id == taskId }
        withDismissed != null
        withDismissed.dismissedReason == "Not applicable to this entity"
    }

    def "a dismissal without a reason is rejected"() {
        given:
        String adminToken = createAdminToken("admin6@tasks.com", "tasksAdmin6")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner6@tasks.com", "taskOwner6")
        createEntity(ownerToken, "ReasonlessEntity")
        def taskId = getTasks(ownerToken).tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.id

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/tasks/${taskId}/dismissal", [reason: ""]).bearerAuth(ownerToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.BAD_REQUEST
    }

    def "a user cannot dismiss a to-do for an item they are not responsible for"() {
        given:
        String adminToken = createAdminToken("admin7@tasks.com", "tasksAdmin7")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner7@tasks.com", "taskOwner7")
        createEntity(ownerToken, "OtherPeoplesEntity")
        def taskId = getTasks(ownerToken).tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.id
        String strangerToken = createUserToken("stranger7@tasks.com", "taskStranger7")

        when:
        client.toBlocking().exchange(
            HttpRequest.POST("/tasks/${taskId}/dismissal", [reason: "Not mine"]).bearerAuth(strangerToken), Map)

        then:
        def e = thrown(HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "undoing a dismissal brings the to-do back"() {
        given:
        String adminToken = createAdminToken("admin8@tasks.com", "tasksAdmin8")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner8@tasks.com", "taskOwner8")
        createEntity(ownerToken, "RestorableEntity")
        def taskId = getTasks(ownerToken).tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.id
        client.toBlocking().exchange(
            HttpRequest.POST("/tasks/${taskId}/dismissal", [reason: "Later"]).bearerAuth(ownerToken), Map)

        when:
        def resp = client.toBlocking().exchange(
            HttpRequest.DELETE("/tasks/${taskId}/dismissal").bearerAuth(ownerToken))

        then:
        resp.status == HttpStatus.NO_CONTENT
        getTasks(ownerToken).tasks.any { it.id == taskId }
    }

    def "a dismissal stops counting once the item is changed again"() {
        given:
        String adminToken = createAdminToken("admin9@tasks.com", "tasksAdmin9")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner9@tasks.com", "taskOwner9")
        def key = createEntity(ownerToken, "RevivingEntity")
        def taskId = getTasks(ownerToken).tasks.find { it.ruleCode == "MISSING_MANDATORY_FIELD" }.id
        client.toBlocking().exchange(
            HttpRequest.POST("/tasks/${taskId}/dismissal", [reason: "Nothing to describe"]).bearerAuth(ownerToken), Map)
        assert getTasks(ownerToken).tasks.every { it.id != taskId }

        when: "the entity is touched again — a storage-location edit leaves the key (and task id) alone"
        Thread.sleep(1100)
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${key}/storage-locations", [locations: ["CH"]])
                .bearerAuth(ownerToken), Map)

        then: "the dismissal no longer hides the still-open gap"
        getTasks(ownerToken).tasks.any { it.id == taskId }
    }

    // ─── admin aggregate ───────────────────────────────────────────────────────

    def "the by-owner view groups outstanding work per responsible owner"() {
        given:
        String adminToken = createAdminToken("admin10@tasks.com", "tasksAdmin10")
        makeDescriptionMandatory(adminToken)
        String ownerToken = createUserToken("owner10@tasks.com", "taskOwner10")
        createEntity(ownerToken, "CountedEntityOne")
        createEntity(ownerToken, "CountedEntityTwo")

        when:
        def body = client.toBlocking().exchange(
            HttpRequest.GET("/tasks/by-owner").bearerAuth(adminToken), Map).body()

        then:
        def bucket = body.owners.find { it.user?.username == "taskOwner10" }
        bucket != null
        bucket.required >= 2
        bucket.total >= 2
    }
}
