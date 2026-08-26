package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.BusinessDomain
import org.leargon.backend.domain.BusinessEntity
import org.leargon.backend.domain.Classification
import org.leargon.backend.domain.FieldConfiguration
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.OrganisationalUnit
import org.leargon.backend.domain.Process
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.TaskRuleConfiguration
import org.leargon.backend.domain.User
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.ClassificationValueRepository
import org.leargon.backend.repository.FieldConfigurationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.repository.ProcessVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.TaskDismissalRepository
import org.leargon.backend.repository.TaskRuleConfigurationRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Rule-by-rule coverage of the derivation itself, driven straight through the repositories so each
 * rule can be isolated without building the whole HTTP fixture.
 */
@MicronautTest(transactional = false)
class TaskServiceSpec extends Specification {

    @Inject TaskService taskService
    @Inject UserService userService
    @Inject UserRepository userRepository
    @Inject BusinessEntityRepository entityRepository
    @Inject BusinessEntityVersionRepository entityVersionRepository
    @Inject ProcessRepository processRepository
    @Inject ProcessVersionRepository processVersionRepository
    @Inject BusinessDomainRepository domainRepository
    @Inject OrganisationalUnitRepository unitRepository
    @Inject FieldConfigurationRepository fieldConfigurationRepository
    @Inject ClassificationRepository classificationRepository
    @Inject ClassificationValueRepository classificationValueRepository
    @Inject TaskRuleConfigurationRepository taskRuleConfigurationRepository
    @Inject TaskDismissalRepository taskDismissalRepository
    @Inject SupportedLocaleRepository localeRepository

    def setup() {
        cleanupData()
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
            localeRepository.save(new SupportedLocale(
                localeCode: "de", displayName: "Deutsch", isDefault: false, isActive: true, sortOrder: 2))
        }
    }

    def cleanup() {
        cleanupData()
    }

    private void cleanupData() {
        taskDismissalRepository.deleteAll()
        taskRuleConfigurationRepository.deleteAll()
        fieldConfigurationRepository.deleteAll()
        classificationValueRepository.deleteAll()
        classificationRepository.deleteAll()
        processVersionRepository.deleteAll()
        processRepository.deleteAll()
        entityVersionRepository.deleteAll()
        entityRepository.deleteAll()
        domainRepository.deleteAll()
        unitRepository.deleteAll()
        userRepository.deleteAll()
    }

    // ─── helpers ───────────────────────────────────────────────────────────────

    private User createUser(String email = "owner@service.test", String username = "serviceOwner") {
        userService.createUser(new SignupRequest(email, username, "password123", "Test", "User"))
    }

    private void enableRules(String... codes) {
        codes.each { code ->
            taskRuleConfigurationRepository.save(new TaskRuleConfiguration(ruleCode: code, enabled: true))
        }
    }

    private BusinessEntity saveEntity(User owner, String key, boolean personalData = false) {
        entityRepository.save(new BusinessEntity(
            key: key,
            names: [new LocalizedText("en", key)],
            dataOwner: owner,
            createdBy: owner,
            containsPersonalData: personalData))
    }

    private Process saveProcess(User owner, String key, Map opts = [:]) {
        def process = new Process(
            key: key,
            names: [new LocalizedText("en", key)],
            processOwner: owner,
            createdBy: owner)
        if (opts.inputEntities) process.inputEntities = opts.inputEntities as Set
        if (opts.legalBasis) process.legalBasis = opts.legalBasis
        processRepository.save(process)
    }

    private List tasksOf(User user, String ruleCode = null) {
        def tasks = taskService.getMyTasks(user.email, false).tasks
        ruleCode ? tasks.findAll { it.ruleCode == ruleCode } : tasks
    }

    // ─── ownership ─────────────────────────────────────────────────────────────

    def "an item with no owner and no steward is on nobody's list"() {
        given:
        def owner = createUser()
        entityRepository.save(new BusinessEntity(
            key: "orphan", names: [new LocalizedText("en", "Orphan")], createdBy: owner))
        enableRules("MISSING_STEWARD")

        expect:
        tasksOf(owner).every { it.resourceKey != "orphan" }

        and: "but an administrator can see it in the unassigned bucket"
        taskService.getTasksByOwner().owners.any { it.user == null }
    }

    def "resource names come back with every locale so the frontend can localise them"() {
        given:
        def owner = createUser()
        entityRepository.save(new BusinessEntity(
            key: "bilingual",
            names: [new LocalizedText("en", "Customer"), new LocalizedText("de", "Kunde")],
            dataOwner: owner,
            createdBy: owner))
        enableRules("MISSING_STEWARD")

        when:
        def task = tasksOf(owner, "MISSING_STEWARD").find { it.resourceKey == "bilingual" }

        then:
        task != null
        task.resourceNames*.locale.containsAll(["en", "de"])
        task.resourceNames.find { it.locale == "de" }.text == "Kunde"
    }

    def "a mandatory classification is named after the classification, not its key"() {
        given:
        def owner = createUser()
        classificationRepository.save(new Classification(
            key: "data-sensitivity",
            names: [new LocalizedText("en", "Data Sensitivity"), new LocalizedText("de", "Datensensitivität")],
            assignableTo: "BUSINESS_ENTITY",
            createdBy: owner))
        fieldConfigurationRepository.save(new FieldConfiguration(
            entityType: "BUSINESS_ENTITY",
            fieldName: "classification.data-sensitivity",
            visibility: "SHOWN",
            section: "DATA_GOVERNANCE",
            maturityLevel: "BASIC"))
        saveEntity(owner, "unclassified")

        when:
        def task = tasksOf(owner, "MISSING_MANDATORY_FIELD").find { it.fieldName == "classification.data-sensitivity" }

        then:
        task != null
        task.fieldLabels.find { it.locale == "en" }.text == "Classification: Data Sensitivity"
        task.fieldLabels.find { it.locale == "de" }.text == "Klassifizierung: Datensensitivität"
    }

    // ─── individual rules ──────────────────────────────────────────────────────

    def "a personal-data process without a legal basis raises a required to-do"() {
        given:
        def owner = createUser()
        def entity = saveEntity(owner, "personaldata", true)
        saveProcess(owner, "intake", [inputEntities: [entity]])

        when:
        def tasks = tasksOf(owner, "NO_LEGAL_BASIS")

        then:
        tasks.size() == 1
        tasks[0].priority.value == "REQUIRED"
        tasks[0].severity.value == "ERROR"
        tasks[0].fieldName == "legalBasis"
        tasks[0].fieldLabels.find { it.locale == "en" }.text == "Legal Basis"
        tasks[0].methodology == "GDPR"
    }

    def "a process that touches no personal data is never asked for a legal basis"() {
        given:
        def owner = createUser()
        def entity = saveEntity(owner, "ordinary", false)
        saveProcess(owner, "plainprocess", [inputEntities: [entity]])

        expect:
        tasksOf(owner, "NO_LEGAL_BASIS").isEmpty()
        tasksOf(owner, "MISSING_PURPOSE").isEmpty()
    }

    def "a process with no entities at all raises the coverage to-do once enabled"() {
        given:
        def owner = createUser()
        saveProcess(owner, "emptyprocess")
        enableRules("NO_ENTITY_COVERAGE", "NO_EXECUTING_UNIT")

        expect:
        tasksOf(owner, "NO_ENTITY_COVERAGE").size() == 1
        tasksOf(owner, "NO_EXECUTING_UNIT").size() == 1
    }

    def "an entity outside a bounded context raises the DDD to-do once enabled"() {
        given:
        def owner = createUser()
        saveEntity(owner, "contextless")
        enableRules("ENTITY_NO_BOUNDED_CONTEXT")

        expect:
        tasksOf(owner, "ENTITY_NO_BOUNDED_CONTEXT").size() == 1
    }

    def "an organisational unit without a mission statement or topology type raises both to-dos"() {
        given:
        def owner = createUser()
        unitRepository.save(new OrganisationalUnit(
            key: "team-a", names: [new LocalizedText("en", "Team A")], businessOwner: owner, createdBy: owner))
        enableRules("MISSING_MISSION_STATEMENT", "MISSING_TOPOLOGY_TYPE")

        expect:
        tasksOf(owner, "MISSING_MISSION_STATEMENT").size() == 1
        tasksOf(owner, "MISSING_TOPOLOGY_TYPE").size() == 1
    }

    def "a domain with no bounded context raises the DDD to-do for the owning unit's owner"() {
        given:
        def owner = createUser()
        def unit = unitRepository.save(new OrganisationalUnit(
            key: "team-b", names: [new LocalizedText("en", "Team B")], businessOwner: owner, createdBy: owner))
        domainRepository.save(new BusinessDomain(
            key: "sales", names: [new LocalizedText("en", "Sales")], owningUnit: unit, createdBy: owner))
        enableRules("DOMAIN_NO_BOUNDED_CONTEXT")

        expect:
        tasksOf(owner, "DOMAIN_NO_BOUNDED_CONTEXT").size() == 1
    }

    // ─── ordering ──────────────────────────────────────────────────────────────

    def "required to-dos sort before recommended ones"() {
        given:
        def owner = createUser()
        def entity = saveEntity(owner, "sorted", true)
        saveProcess(owner, "sortedprocess", [inputEntities: [entity]])
        enableRules("ENTITY_NO_BOUNDED_CONTEXT", "MISSING_STEWARD")

        when:
        def tasks = tasksOf(owner)
        def firstRecommended = tasks.findIndexOf { it.priority.value == "RECOMMENDED" }
        def lastRequired = tasks.findLastIndexOf { it.priority.value == "REQUIRED" }

        then:
        firstRecommended >= 0
        lastRequired >= 0
        lastRequired < firstRecommended
    }
}
