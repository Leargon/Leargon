package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.model.BusinessDomainType
import org.leargon.backend.model.CreateBusinessDomainRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessDomainServiceSpec extends Specification {

    @Inject
    BusinessDomainRepository domainRepository

    @Inject
    BusinessDomainVersionRepository domainVersionRepository

    @Inject
    UserRepository userRepository

    @Inject
    SupportedLocaleRepository localeRepository

    @Inject
    UserService userService

    @Inject
    BusinessDomainService domainService

    def setup() {
        cleanupTestData()
        ensureLocalesExist()
    }

    def cleanup() {
        cleanupTestData()
    }

    private void cleanupTestData() {
        domainVersionRepository.deleteAll()
        // Delete domains individually to trigger JPA cascades
        // First delete children (domains with parents), then parents (top-level)
        def allDomains = domainRepository.findAll()
        def childDomains = allDomains.findAll { it.parent != null }
        def topDomains = allDomains.findAll { it.parent == null }

        childDomains.each { domain ->
            try { domainRepository.delete(domain) } catch (ignored) {}
        }
        topDomains.each { domain ->
            try { domainRepository.delete(domain) } catch (ignored) {}
        }

        userRepository.deleteAll()
    }

    private void ensureLocalesExist() {
        if (localeRepository.count() == 0) {
            def enLocale = new SupportedLocale()
            enLocale.localeCode = "en"
            enLocale.displayName = "English"
            enLocale.isDefault = true
            enLocale.isActive = true
            enLocale.sortOrder = 1
            localeRepository.save(enLocale)

            def deLocale = new SupportedLocale()
            deLocale.localeCode = "de"
            deLocale.displayName = "German"
            deLocale.isDefault = false
            deLocale.isActive = true
            deLocale.sortOrder = 2
            localeRepository.save(deLocale)
        }
    }

    private User createTestUser(String email, String username) {
        def request = new SignupRequest(email, username, "password123", "Test", "User")
        return userService.createUser(request)
    }

    private User createAdminUser(String email, String username) {
        def user = createTestUser(email, username)
        user.roles = "ROLE_USER,ROLE_ADMIN"
        return userRepository.update(user)
    }

    // =====================
    // CREATE DOMAIN TESTS
    // =====================

    def "should create domain with valid translations"() {
        given: "an admin user and a create request"
        def admin = createAdminUser("admin@example.com", "admin")
        def enTranslation = new LocalizedText("en", "Sales")
        def deTranslation = new LocalizedText("de", "Vertrieb")
        def request = new CreateBusinessDomainRequest([enTranslation, deTranslation])

        when: "creating a businessDomain"
        def domain = domainService.createBusinessDomain(request, admin)

        then: "businessDomain is created successfully"
        domain != null
        domain.key == "sales"
        domain.createdBy.username == admin.username
        domain.names.size() == 2

        and: "names are correct"
        def enResult = domain.names.find { it.locale == "en" }
        enResult.text == "Sales"

        def deResult = domain.names.find { it.locale == "de" }
        deResult.text == "Vertrieb"
    }

    def "should create domain with domain type"() {
        given: "an admin user and a create request with businessDomain type"
        def admin = createAdminUser("admin@example.com", "admin")
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "Core Services")])
        request.type = BusinessDomainType.CORE

        when: "creating a businessDomain with type"
        def domain = domainService.createBusinessDomain(request, admin)

        then: "businessDomain type is set"
        domain.type == "CORE"
        domain.effectiveType == "CORE"
    }

    def "should create subdomain with parent"() {
        given: "a parent businessDomain and a subdomain request"
        def admin = createAdminUser("admin@example.com", "admin")
        def parentRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Sales")])
        def parent = domainService.createBusinessDomain(parentRequest, admin)

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "B2B Sales")])
        childRequest.parentKey = parent.key

        when: "creating a subdomain"
        def child = domainService.createBusinessDomain(childRequest, admin)

        then: "subdomain has correct parent and hierarchical key"
        child.parent.key == parent.key
        child.key == "sales.b2b-sales"
    }

    def "should inherit domain type from parent"() {
        given: "a parent businessDomain with type and a subdomain without type"
        def admin = createAdminUser("admin@example.com", "admin")
        def parentRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Sales")])
        parentRequest.type = BusinessDomainType.BUSINESS
        def parent = domainService.createBusinessDomain(parentRequest, admin)

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "B2B Sales")])
        childRequest.parentKey = parent.key

        when: "creating a subdomain without type"
        def child = domainService.createBusinessDomain(childRequest, admin)

        then: "subdomain inherits parent's businessDomain type"
        child.type == null
        child.effectiveType == "BUSINESS"
    }

    def "should throw exception when default locale translation is missing"() {
        given: "an admin user and a request without default locale"
        def admin = createAdminUser("admin@example.com", "admin")
        def request = new CreateBusinessDomainRequest([new LocalizedText("de", "Nur Deutsch")])

        when: "creating a businessDomain without default locale"
        domainService.createBusinessDomain(request, admin)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("default locale")
    }

    def "should throw exception when translation name is empty"() {
        given: "an admin user and a request with empty names"
        def admin = createAdminUser("admin@example.com", "admin")
        def translation = new LocalizedText("en", "")
        def request = new CreateBusinessDomainRequest([translation])

        when: "creating a businessDomain with empty names"
        domainService.createBusinessDomain(request, admin)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("Text is required")
    }

    def "should throw exception when parent domain not found"() {
        given: "an admin user and a request with non-existent parent"
        def admin = createAdminUser("admin@example.com", "admin")
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "Orphan")])
        request.parentKey = "non-existent-parent"

        when: "creating a businessDomain with non-existent parent"
        domainService.createBusinessDomain(request, admin)

        then: "ResourceNotFoundException is thrown"
        def exception = thrown(ResourceNotFoundException)
        exception.message.contains("Parent BusinessDomain not found")
    }

    // =====================
    // GET DOMAIN TESTS
    // =====================

    def "should get domain by key"() {
        given: "a created businessDomain"
        def admin = createAdminUser("admin@example.com", "admin")
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        def created = domainService.createBusinessDomain(request, admin)

        when: "getting businessDomain by key"
        def domain = domainService.getBusinessDomainByKey(created.key)

        then: "businessDomain is found"
        domain != null
        domain.key == created.key
    }

    def "should throw exception when domain not found"() {
        when: "getting non-existent businessDomain"
        domainService.getBusinessDomainByKey("non-existent-key")

        then: "ResourceNotFoundException is thrown"
        def exception = thrown(ResourceNotFoundException)
        exception.message == "BusinessDomain not found"
    }

    def "should get all domains"() {
        given: "multiple domains"
        def admin = createAdminUser("admin@example.com", "admin")
        domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 1")]), admin)
        domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 2")]), admin)

        when: "getting all domains"
        def domains = domainService.getAllBusinessDomains()

        then: "all domains are returned"
        domains.size() == 2
    }

    def "should get domain tree"() {
        given: "a businessDomain hierarchy"
        def admin = createAdminUser("admin@example.com", "admin")
        def parentRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")])
        def parent = domainService.createBusinessDomain(parentRequest, admin)

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parent.key
        domainService.createBusinessDomain(childRequest, admin)

        when: "getting businessDomain tree"
        def tree = domainService.getBusinessDomainTree()

        then: "only top-level domains are returned"
        tree.size() == 1
        tree[0].key == parent.key
        tree[0].children.size() == 1
    }

    // =====================
    // UPDATE DOMAIN TESTS (granular endpoints)
    // =====================

    def "should update domain names"() {
        given: "a created businessDomain"
        def admin = createAdminUser("admin@example.com", "admin")
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Original")])
        def domain = domainService.createBusinessDomain(createRequest, admin)

        when: "updating businessDomain names"
        def updated = domainService.updateBusinessDomainNames(domain.key, [new LocalizedText("en", "Updated")], admin)

        then: "businessDomain is updated"
        updated.names.find { it.locale == "en" }.text == "Updated"
    }

    def "should update domain type"() {
        given: "a created businessDomain without type"
        def admin = createAdminUser("admin@example.com", "admin")
        def createRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")])
        def domain = domainService.createBusinessDomain(createRequest, admin)

        when: "updating businessDomain type"
        def updated = domainService.updateBusinessDomainType(domain.key, BusinessDomainType.SUPPORT.value, admin)

        then: "businessDomain type is updated"
        updated.type == "SUPPORT"
        updated.effectiveType == "SUPPORT"
    }

    def "should update parent domain"() {
        given: "two domains"
        def admin = createAdminUser("admin@example.com", "admin")
        def domain1 = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 1")]), admin)
        def domain2 = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain 2")]), admin)

        when: "updating parent"
        def updated = domainService.updateBusinessDomainParent(domain2.key, domain1.key, admin)

        then: "parent is updated"
        updated.parent.key == domain1.key
    }

    def "should throw exception when setting domain as its own parent"() {
        given: "a created businessDomain"
        def admin = createAdminUser("admin@example.com", "admin")
        def domain = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "BusinessDomain")]), admin)

        when: "updating parent to self"
        domainService.updateBusinessDomainParent(domain.key, domain.key, admin)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("cannot be its own parent")
    }

    def "should throw exception when creating cycle in hierarchy"() {
        given: "a businessDomain hierarchy"
        def admin = createAdminUser("admin@example.com", "admin")
        def parent = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")]), admin)

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parent.key
        def child = domainService.createBusinessDomain(childRequest, admin)

        when: "updating parent to child (creating cycle)"
        domainService.updateBusinessDomainParent(parent.key, child.key, admin)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("cycle")
    }

    // =====================
    // DELETE DOMAIN TESTS
    // =====================

    def "should delete domain"() {
        given: "a created BusinessDomain"
        def admin = createAdminUser("admin@example.com", "admin")
        def request = new CreateBusinessDomainRequest([new LocalizedText("en", "ToDelete")])
        def domain = domainService.createBusinessDomain(request, admin)

        when: "deleting BusinessDomain"
        domainService.deleteBusinessDomain(domain.key, admin)

        and: "trying to get the BusinessDomain"
        domainService.getBusinessDomainByKey(domain.key)

        then: "BusinessDomain is not found"
        thrown(ResourceNotFoundException)
    }

    def "should detach children when parent is deleted"() {
        given: "a businessDomain hierarchy"
        def admin = createAdminUser("admin@example.com", "admin")
        def parent = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "Parent")]), admin)

        def childRequest = new CreateBusinessDomainRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parent.key
        def child = domainService.createBusinessDomain(childRequest, admin)

        when: "deleting parent"
        domainService.deleteBusinessDomain(parent.key, admin)

        then: "child still exists but has no parent"
        def updatedChild = domainService.getBusinessDomainByKey("child")
        updatedChild != null
        updatedChild.parent == null
        updatedChild.key == "child"
    }

    def "should throw exception when deleting non-existent domain"() {
        given: "an admin user"
        def admin = createAdminUser("admin@example.com", "admin")

        when: "deleting non-existent businessDomain"
        domainService.deleteBusinessDomain("non-existent-key", admin)

        then: "ResourceNotFoundException is thrown"
        thrown(ResourceNotFoundException)
    }

    // =====================
    // VERSION HISTORY TESTS
    // =====================

    def "should create version on domain creation"() {
        given: "an admin user"
        def admin = createAdminUser("admin@example.com", "admin")

        when: "creating a domain"
        def domain = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "Sales")]), admin)

        then: "initial version exists"
        def versions = domainService.getVersionHistory(domain.key)
        versions.size() == 1
        versions[0].versionNumber == 1
        versions[0].changeType.value == "CREATE"
    }

    def "should create version on domain name update"() {
        given: "a created domain"
        def admin = createAdminUser("admin@example.com", "admin")
        def domain = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "Original")]), admin)

        when: "updating names"
        def updated = domainService.updateBusinessDomainNames(domain.key, [new LocalizedText("en", "Updated")], admin)

        then: "new version is created"
        def versions = domainService.getVersionHistory(updated.key)
        versions.size() == 2
        versions[0].versionNumber == 2
        versions[0].changeType.value == "UPDATE"
    }

    def "should get version diff"() {
        given: "a domain with multiple versions"
        def admin = createAdminUser("admin@example.com", "admin")
        def domain = domainService.createBusinessDomain(new CreateBusinessDomainRequest([new LocalizedText("en", "Original")]), admin)
        def updated = domainService.updateBusinessDomainNames(domain.key, [new LocalizedText("en", "Updated")], admin)

        when: "getting diff for version 2"
        def diff = domainService.getVersionDiff(updated.key, 2)

        then: "diff shows changes"
        diff.versionNumber == 2
        diff.previousVersionNumber == 1
        diff.changes.size() > 0
    }
}
