package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.domain.User
import org.leargon.backend.exception.ForbiddenOperationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.CreateBusinessEntityRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.model.LocalizedText
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

@MicronautTest(transactional = false)
class BusinessEntityServiceSpec extends Specification {

    @Inject
    BusinessEntityRepository entityRepository

    @Inject
    BusinessEntityVersionRepository versionRepository

    @Inject
    UserRepository userRepository

    @Inject
    SupportedLocaleRepository localeRepository

    @Inject
    UserService userService

    @Inject
    BusinessEntityService entityService

    def setup() {
        // Clean up any leftover data from previous tests
        cleanupTestData()

        // Ensure locale data exists
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

    def cleanup() {
        cleanupTestData()
    }

    private void cleanupTestData() {
        // Delete versions first to avoid FK constraint violations
        versionRepository.deleteAll()
        // Delete entities one by one to trigger JPA cascade
        entityRepository.findAll().each { entity ->
            entityRepository.delete(entity)
        }
        userRepository.deleteAll()
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

    def "should create entity with valid translations"() {
        given: "a user and a create request"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([
                new LocalizedText("en", "Customer"),
                new LocalizedText("de", "Kunde")
        ])

        when: "creating an entity"
        def entity = entityService.createBusinessEntity(request, user)

        then: "entity is created successfully"
        entity != null
        entity.key == "customer"
        entity.dataOwner.username == user.username
        entity.createdBy.username == user.username
        entity.names.size() == 2

        and: "names are correct"
        def enName = entity.names.find { it.locale == "en" }
        enName.text == "Customer"

        def deName = entity.names.find { it.locale == "de" }
        deName.text == "Kunde"
    }

    def "should create entity with custom data owner"() {
        given: "a creator and a different data owner"
        def creator = createTestUser("creator@example.com", "creator")
        def owner = createTestUser("owner@example.com", "owner")

        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        request.dataOwnerUsername = "owner"

        when: "creating an entity with custom data owner"
        def entity = entityService.createBusinessEntity(request, creator)

        then: "data owner is set correctly"
        entity.dataOwner.username == "owner"
        entity.createdBy.username == "creator"
    }

    def "should create initial version on entity creation"() {
        given: "a user and a create request"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])

        when: "creating an entity"
        def entity = entityService.createBusinessEntity(request, user)

        and: "getting version history"
        def versions = entityService.getVersionHistory(entity.key)

        then: "initial version exists"
        versions.size() == 1
        versions[0].versionNumber == 1
        versions[0].changeType.value == "CREATE"
        versions[0].changeSummary == "Initial creation"
    }

    def "should throw exception when default locale translation is missing"() {
        given: "a user and a request without default locale"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([new LocalizedText("de", "Nur Deutsch")])

        when: "creating an entity without default locale"
        entityService.createBusinessEntity(request, user)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("default locale")
    }

    def "should throw exception when translation name is empty"() {
        given: "a user and a request with empty text"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "")])

        when: "creating an entity with empty text"
        entityService.createBusinessEntity(request, user)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("Text is required")
    }

    def "should throw exception when locale is unsupported"() {
        given: "a user and a request with unsupported locale"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([
                new LocalizedText("en", "English"),
                new LocalizedText("xyz", "Unknown")
        ])

        when: "creating an entity with unsupported locale"
        entityService.createBusinessEntity(request, user)

        then: "IllegalArgumentException is thrown"
        def exception = thrown(IllegalArgumentException)
        exception.message.contains("Unsupported locale")
    }

    def "should get entity by key"() {
        given: "a created entity"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def created = entityService.createBusinessEntity(request, user)

        when: "getting entity by key"
        def entity = entityService.getBusinessEntityByKey(created.key)

        then: "entity is found"
        entity != null
        entity.key == created.key
    }

    def "should throw exception when entity not found"() {
        when: "getting non-existent entity"
        entityService.getBusinessEntityByKey("non-existent-key")

        then: "ResourceNotFoundException is thrown"
        def exception = thrown(ResourceNotFoundException)
        exception.message == "BusinessEntity not found"
    }

    def "should update entity names"() {
        given: "a created entity"
        def user = createTestUser("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def entity = entityService.createBusinessEntity(createRequest, user)

        when: "updating entity names"
        def updated = entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Updated")], user)

        then: "entity is updated"
        updated.names.find { it.locale == "en" }.text == "Updated"
    }

    def "should create new version on name update"() {
        given: "a created entity"
        def user = createTestUser("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def entity = entityService.createBusinessEntity(createRequest, user)

        when: "updating entity names"
        def updated = entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Updated")], user)

        and: "getting version history"
        def versions = entityService.getVersionHistory(updated.key)

        then: "new version is created"
        versions.size() == 2
        versions[0].versionNumber == 2
        versions[0].changeType.value == "UPDATE"
    }

    def "should allow data owner to edit entity"() {
        given: "an entity with a specific owner"
        def owner = createTestUser("owner@example.com", "owner")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, owner)

        when: "owner updates entity names"
        def updated = entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Updated")], owner)

        then: "update is successful"
        updated.names.find { it.locale == "en" }.text == "Updated"
    }

    def "should allow admin to edit any entity"() {
        given: "an entity owned by a regular user"
        def owner = createTestUser("owner@example.com", "owner")
        def admin = createAdminUser("admin@example.com", "admin")

        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, owner)

        when: "admin updates entity names"
        def updated = entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Updated by Admin")], admin)

        then: "update is successful"
        updated.names.find { it.locale == "en" }.text == "Updated by Admin"
    }

    def "should throw ForbiddenOperationException when non-owner edits entity"() {
        given: "an entity owned by a different user"
        def owner = createTestUser("owner@example.com", "owner")
        def otherUser = createTestUser("other@example.com", "other")

        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, owner)

        when: "non-owner attempts to update names"
        entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Unauthorized Update")], otherUser)

        then: "ForbiddenOperationException is thrown"
        def exception = thrown(ForbiddenOperationException)
        exception.message.contains("Only the data owner or an admin")
    }

    def "should update data owner and create OWNER_CHANGE version"() {
        given: "an entity and a new owner"
        def owner = createTestUser("owner@example.com", "owner")
        def newOwner = createTestUser("newowner@example.com", "newowner")

        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, owner)

        when: "updating data owner"
        def updated = entityService.updateBusinessEntityDataOwner(entity.key, "newowner", owner)

        then: "data owner is changed"
        updated.dataOwner.username == "newowner"

        and: "version type is OWNER_CHANGE"
        def versions = entityService.getVersionHistory(entity.key)
        versions[0].changeType.value == "OWNER_CHANGE"
    }

    def "should delete entity"() {
        given: "a created entity"
        def user = createTestUser("creator@example.com", "creator")
        def request = new CreateBusinessEntityRequest([new LocalizedText("en", "ToDelete")])
        def entity = entityService.createBusinessEntity(request, user)

        when: "deleting entity"
        entityService.deleteBusinessEntity(entity.key, user)

        and: "trying to get the entity"
        entityService.getBusinessEntityByKey(entity.key)

        then: "entity is not found"
        thrown(ResourceNotFoundException)
    }

    def "should throw ForbiddenOperationException when non-owner deletes entity"() {
        given: "an entity owned by a different user"
        def owner = createTestUser("owner@example.com", "owner")
        def otherUser = createTestUser("other@example.com", "other")

        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, owner)

        when: "non-owner attempts to delete"
        entityService.deleteBusinessEntity(entity.key, otherUser)

        then: "ForbiddenOperationException is thrown"
        def exception = thrown(ForbiddenOperationException)
        exception.message.contains("Only the data owner or an admin")
    }

    def "should get version diff"() {
        given: "an entity with multiple versions"
        def user = createTestUser("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Original")])
        def entity = entityService.createBusinessEntity(createRequest, user)

        def updated = entityService.updateBusinessEntityNames(entity.key, [new LocalizedText("en", "Updated")], user)

        when: "getting diff for version 2"
        def diff = entityService.getVersionDiff(updated.key, 2)

        then: "diff shows changes"
        diff.versionNumber == 2
        diff.previousVersionNumber == 1
        diff.changes.size() > 0
    }

    def "should get diff for initial version"() {
        given: "an entity with only initial version"
        def user = createTestUser("creator@example.com", "creator")
        def createRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")])
        def entity = entityService.createBusinessEntity(createRequest, user)

        when: "getting diff for version 1"
        def diff = entityService.getVersionDiff(entity.key, 1)

        then: "diff shows initial creation"
        diff.versionNumber == 1
        diff.previousVersionNumber == null
    }

    def "should get all entities"() {
        given: "multiple entities"
        def user = createTestUser("creator@example.com", "creator")

        entityService.createBusinessEntity(
                new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity 1")]),
                user
        )
        entityService.createBusinessEntity(
                new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity 2")]),
                user
        )

        when: "getting all entities"
        def entities = entityService.getAllBusinessEntities()

        then: "all entities are returned"
        entities.size() == 2
    }

    def "should check canEdit correctly"() {
        given: "an entity with owner and different users"
        def owner = createTestUser("owner@example.com", "owner")
        def admin = createAdminUser("admin@example.com", "admin")
        def otherUser = createTestUser("other@example.com", "other")

        def entity = entityService.createBusinessEntity(
                new CreateBusinessEntityRequest([new LocalizedText("en", "BusinessEntity")]),
                owner
        )

        expect: "canEdit returns correct values"
        entityService.canEdit(entity, owner)
        entityService.canEdit(entity, admin)
        !entityService.canEdit(entity, otherUser)
    }

    def "should detach children when entity is deleted"() {
        given: "a parent entity with a child"
        def user = createTestUser("creator@example.com", "creator")
        def parentRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Parent")])
        def parent = entityService.createBusinessEntity(parentRequest, user)

        def childRequest = new CreateBusinessEntityRequest([new LocalizedText("en", "Child")])
        childRequest.parentKey = parent.key
        def child = entityService.createBusinessEntity(childRequest, user)

        when: "deleting parent"
        entityService.deleteBusinessEntity(parent.key, user)

        then: "child still exists but has no parent"
        def updatedChild = entityService.getBusinessEntityByKey("child")
        updatedChild != null
        updatedChild.parent == null
        updatedChild.key == "child"
    }
}
