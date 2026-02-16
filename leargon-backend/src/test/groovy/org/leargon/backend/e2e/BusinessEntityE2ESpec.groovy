package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class BusinessEntityE2ESpec extends AbstractE2ESpec {

    // =====================
    // CREATE
    // =====================

    def "should create entity with name in default locale"() {
        given:
        def token = signup("ent-create@example.com", "entcreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names: [[locale: "en", text: "Customer"]]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "customer"
        response.body().names.size() == 1
        response.body().names[0].locale == "en"
        response.body().names[0].text == "Customer"
        response.body().dataOwner.username == "entcreate"
        response.body().createdBy.username == "entcreate"
    }

    def "should create entity with multilingual names"() {
        given:
        def token = signup("ent-multi@example.com", "entmulti")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names: [
                                [locale: "en", text: "Customer"],
                                [locale: "de", text: "Kunde"]
                        ]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().names.size() == 2
        response.body().names.any { it.locale == "en" && it.text == "Customer" }
        response.body().names.any { it.locale == "de" && it.text == "Kunde" }
    }

    def "should create entity with custom data owner"() {
        given:
        def creatorToken = signup("ent-creator@example.com", "entcreator")
        signup("ent-owner@example.com", "entowner")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names           : [[locale: "en", text: "Owned Entity"]],
                        dataOwnerUsername: "entowner"
                ]).bearerAuth(creatorToken),
                Map
        )

        then:
        response.body().dataOwner.username == "entowner"
        response.body().createdBy.username == "entcreator"
    }

    def "should reject entity creation without default locale"() {
        given:
        def token = signup("ent-noen@example.com", "entnoen")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names: [[locale: "de", text: "Nur Deutsch"]]
                ]).bearerAuth(token),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "should reject entity creation without authentication"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names: [[locale: "en", text: "NoAuth"]]
                ]),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // READ
    // =====================

    def "should get entity by key"() {
        given:
        def token = signup("ent-get@example.com", "entget")
        def entity = createEntity(token, "Readable Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entity.key}").bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == entity.key
    }

    def "should return 404 for non-existent entity"() {
        given:
        def token = signup("ent-404@example.com", "ent404")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/nonexistent-key").bearerAuth(token),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    def "should list all entities"() {
        given:
        def token = signup("ent-list@example.com", "entlist")
        createEntity(token, "Entity A")
        createEntity(token, "Entity B")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 2
    }

    def "should get entity tree"() {
        given:
        def token = signup("ent-tree@example.com", "enttree")
        def parent = createEntity(token, "Tree Parent")
        createEntity(token, "Tree Child", [parentKey: parent.key])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/tree").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().any { it.key == parent.key && it.children?.size() >= 1 }
    }

    // =====================
    // UPDATE NAMES
    // =====================

    def "should update entity names as owner"() {
        given:
        def token = signup("ent-upnames@example.com", "entupnames")
        def entity = createEntity(token, "Original Name")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names", [
                        [locale: "en", text: "Updated Name"],
                        [locale: "de", text: "Aktualisierter Name"]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().names.size() == 2
        response.body().names.any { it.locale == "en" && it.text == "Updated Name" }
        response.body().names.any { it.locale == "de" && it.text == "Aktualisierter Name" }
    }

    def "should update entity names as admin (not owner)"() {
        given:
        def ownerToken = signup("ent-nameowner@example.com", "entnameowner")
        def entity = createEntity(ownerToken, "Owner Entity")
        def adminToken = signupAdmin("ent-nameadmin@example.com", "entnameadmin")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names", [
                        [locale: "en", text: "Admin Updated"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().names.find { it.locale == "en" }.text == "Admin Updated"
    }

    def "should reject name update by non-owner non-admin"() {
        given:
        def ownerToken = signup("ent-nameown2@example.com", "entnameown2")
        def entity = createEntity(ownerToken, "Protected Entity")
        def otherToken = signup("ent-nameother@example.com", "entnameother")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names", [
                        [locale: "en", text: "Unauthorized"]
                ]).bearerAuth(otherToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // UPDATE DESCRIPTIONS
    // =====================

    def "should update entity descriptions"() {
        given:
        def token = signup("ent-desc@example.com", "entdesc")
        def entity = createEntity(token, "Desc Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/descriptions", [
                        [locale: "en", text: "A detailed description"],
                        [locale: "de", text: "Eine detaillierte Beschreibung"]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().descriptions.size() == 2
        response.body().descriptions.any { it.locale == "en" && it.text == "A detailed description" }
    }

    // =====================
    // UPDATE DATA OWNER
    // =====================

    def "should change data owner"() {
        given:
        def ownerToken = signup("ent-chown@example.com", "entchown")
        signup("ent-newown@example.com", "entnewown")
        def entity = createEntity(ownerToken, "Ownership Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/data-owner", [
                        dataOwnerUsername: "entnewown"
                ]).bearerAuth(ownerToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().dataOwner.username == "entnewown"
    }

    // =====================
    // UPDATE DOMAIN ASSIGNMENT
    // =====================

    def "should assign entity to a business domain"() {
        given:
        def adminToken = signupAdmin("ent-domain@example.com", "entdomain")
        def domain = createDomain(adminToken, "Sales Domain")
        def entity = createEntity(adminToken, "Domain Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/domain", [
                        businessDomainKey: domain.key
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().businessDomain != null
        response.body().businessDomain.key == domain.key
    }

    // =====================
    // UPDATE PARENT (HIERARCHY)
    // =====================

    def "should set parent entity"() {
        given:
        def token = signup("ent-parent@example.com", "entparent")
        def parent = createEntity(token, "Parent Entity")
        def child = createEntity(token, "Child Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${child.key}/parent", [
                        parentKey: parent.key
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().parentKey == parent.key
    }

    def "should create entity with parent in creation request"() {
        given:
        def token = signup("ent-parcreat@example.com", "entparcreat")
        def parent = createEntity(token, "Creation Parent")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names    : [[locale: "en", text: "Creation Child"]],
                        parentKey: parent.key
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().parentKey == parent.key
    }

    // =====================
    // CLASSIFICATIONS
    // =====================

    def "should assign classifications to entity"() {
        given:
        def adminToken = signupAdmin("ent-classif@example.com", "entclassif")
        def classif = createClassification(adminToken, "Entity Priority", "BUSINESS_ENTITY", [
                [key: "high", names: [[locale: "en", text: "High"]]],
                [key: "low", names: [[locale: "en", text: "Low"]]]
        ])
        def entity = createEntity(adminToken, "Classified Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/classifications", [
                        [classificationKey: classif.key, valueKey: "high"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().classificationAssignments.size() == 1
        response.body().classificationAssignments[0].classificationKey == classif.key
        response.body().classificationAssignments[0].valueKey == "high"
    }

    def "should update classification assignment on entity"() {
        given:
        def adminToken = signupAdmin("ent-classup@example.com", "entclassup")
        def classif = createClassification(adminToken, "Entity Level", "BUSINESS_ENTITY", [
                [key: "bronze", names: [[locale: "en", text: "Bronze"]]],
                [key: "gold", names: [[locale: "en", text: "Gold"]]]
        ])
        def entity = createEntity(adminToken, "Level Entity")

        // Assign bronze
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/classifications", [
                        [classificationKey: classif.key, valueKey: "bronze"]
                ]).bearerAuth(adminToken), Map
        )

        when: "changing to gold"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/classifications", [
                        [classificationKey: classif.key, valueKey: "gold"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().classificationAssignments[0].valueKey == "gold"
    }

    // =====================
    // INTERFACES
    // =====================

    def "should assign interface entities"() {
        given:
        def token = signup("ent-iface@example.com", "entiface")
        def interfaceEntity = createEntity(token, "Interface API")
        def implEntity = createEntity(token, "Implementation Service")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${implEntity.key}/interfaces", [
                        [interfaceEntityKey: interfaceEntity.key]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
    }

    // =====================
    // RELATIONSHIPS
    // =====================

    def "should create, update, and delete a relationship"() {
        given:
        def token = signup("ent-rel@example.com", "entrel")
        def entity1 = createEntity(token, "Order")
        def entity2 = createEntity(token, "Product")

        when: "creating a relationship"
        def createRelResponse = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities/${entity1.key}/relationships", [
                        secondBusinessEntityKey: entity2.key,
                        firstCardinalityMinimum: 1,
                        firstCardinalityMaximum: 1,
                        secondCardinalityMinimum: 0,
                        descriptions: [[locale: "en", text: "Order contains products"]]
                ]).bearerAuth(token),
                Map
        )

        then:
        createRelResponse.status == HttpStatus.CREATED
        def relId = createRelResponse.body().id

        when: "updating the relationship"
        def updateRelResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity1.key}/relationships/${relId}", [
                        firstCardinalityMinimum : 1,
                        firstCardinalityMaximum : 10,
                        secondCardinalityMinimum: 1,
                        secondCardinalityMaximum: 100,
                        descriptions            : [[locale: "en", text: "Updated relationship description"]]
                ]).bearerAuth(token),
                Map
        )

        then:
        updateRelResponse.status == HttpStatus.OK

        when: "deleting the relationship"
        def deleteRelResponse = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entity1.key}/relationships/${relId}")
                        .bearerAuth(token)
        )

        then:
        deleteRelResponse.status == HttpStatus.NO_CONTENT
    }

    // =====================
    // VERSION HISTORY
    // =====================

    def "should track version history through create and updates"() {
        given:
        def token = signup("ent-ver@example.com", "entver")
        def entity = createEntity(token, "Versioned Entity")
        def entityKey = entity.key

        // Update names to create version 2
        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entityKey}/names", [
                        [locale: "en", text: "Updated Versioned"]
                ]).bearerAuth(token),
                Map
        )
        def updatedKey = updateResponse.body().key

        when: "getting version history"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${updatedKey}/versions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.body().size() == 2
        response.body().any { it.versionNumber == 1 && it.changeType == "CREATE" }
        response.body().any { it.versionNumber == 2 && it.changeType == "UPDATE" }
    }

    def "should return version diff"() {
        given:
        def token = signup("ent-diff@example.com", "entdiff")
        def entity = createEntity(token, "Diffable Entity")

        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/names", [
                        [locale: "en", text: "Modified Entity"]
                ]).bearerAuth(token),
                Map
        )
        def updatedKey = updateResponse.body().key

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${updatedKey}/versions/2/diff").bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().versionNumber == 2
        response.body().previousVersionNumber == 1
        response.body().changes != null
        response.body().changes.size() > 0
    }

    def "should return initial version diff"() {
        given:
        def token = signup("ent-initdiff@example.com", "entinitdiff")
        def entity = createEntity(token, "Initial Diff Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entity.key}/versions/1/diff").bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().versionNumber == 1
        response.body().previousVersionNumber == null
    }

    // =====================
    // DELETE
    // =====================

    def "should delete entity as owner"() {
        given:
        def token = signup("ent-del@example.com", "entdel")
        def entity = createEntity(token, "Deletable Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entity.key}").bearerAuth(token)
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        when: "verifying entity is gone"
        client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entity.key}").bearerAuth(token), Map
        )

        then:
        thrown(HttpClientResponseException)
    }

    def "should delete entity as admin (not owner)"() {
        given:
        def ownerToken = signup("ent-delown@example.com", "entdelown")
        def entity = createEntity(ownerToken, "Admin Deletable")
        def adminToken = signupAdmin("ent-deladmin@example.com", "entdeladmin")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entity.key}").bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.NO_CONTENT
    }

    def "should reject delete by non-owner non-admin"() {
        given:
        def ownerToken = signup("ent-delown2@example.com", "entdelown2")
        def entity = createEntity(ownerToken, "Protected Del Entity")
        def otherToken = signup("ent-delother@example.com", "entdelother")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${entity.key}").bearerAuth(otherToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // FULL CRUD LIFECYCLE
    // =====================

    def "should perform complete entity lifecycle: create, read, update all fields, version, delete"() {
        given: "admin user with a domain and classification"
        def adminToken = signupAdmin("ent-lifecycle@example.com", "entlifecycle")
        signup("ent-newowner@example.com", "entnewowner2")
        def domain = createDomain(adminToken, "Lifecycle Domain")
        def classif = createClassification(adminToken, "Lifecycle Class", "BUSINESS_ENTITY", [
                [key: "a", names: [[locale: "en", text: "Value A"]]],
                [key: "b", names: [[locale: "en", text: "Value B"]]]
        ])

        when: "1. Create entity"
        def entity = createEntity(adminToken, "Lifecycle Entity")
        def key = entity.key

        then:
        key == "lifecycle-entity"

        when: "2. Update names"
        def namesResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/names", [
                        [locale: "en", text: "Updated Lifecycle"],
                        [locale: "de", text: "Lebenszyklus"]
                ]).bearerAuth(adminToken), Map
        )
        key = namesResp.body().key

        then:
        namesResp.body().names.size() == 2

        when: "3. Update descriptions"
        def descResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/descriptions", [
                        [locale: "en", text: "Lifecycle description"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        descResp.body().descriptions.size() == 1

        when: "4. Assign domain"
        def domResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/domain", [
                        businessDomainKey: domain.key
                ]).bearerAuth(adminToken), Map
        )

        then:
        domResp.body().businessDomain.key == domain.key

        when: "5. Assign classification"
        def classResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/classifications", [
                        [classificationKey: classif.key, valueKey: "a"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        classResp.body().classificationAssignments.size() == 1

        when: "6. Change data owner"
        def ownerResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${key}/data-owner", [
                        dataOwnerUsername: "entnewowner2"
                ]).bearerAuth(adminToken), Map
        )

        then:
        ownerResp.body().dataOwner.username == "entnewowner2"

        when: "7. Check version history has all changes"
        def versResp = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${key}/versions").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then: "multiple versions created"
        versResp.body().size() >= 2

        when: "8. Delete entity"
        def delResp = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${key}").bearerAuth(adminToken)
        )

        then:
        delResp.status == HttpStatus.NO_CONTENT
    }

    // =====================
    // DELETION CASCADE EFFECTS
    // =====================

    def "should detach children when parent entity is deleted"() {
        given:
        def token = signup("ent-cascade@example.com", "entcascade")
        def parent = createEntity(token, "Cascade Parent")
        def child = createEntity(token, "Cascade Child", [parentKey: parent.key])

        when: "deleting parent"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-entities/${parent.key}").bearerAuth(token)
        )

        then: "child still exists with no parent"
        def childResp = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/cascade-child").bearerAuth(token), Map
        )
        childResp.status == HttpStatus.OK
        childResp.body().parentKey == null
    }

    def "should detach entity from domain when domain is deleted"() {
        given:
        def adminToken = signupAdmin("ent-domcasc@example.com", "entdomcasc")
        def domain = createDomain(adminToken, "Ephemeral Domain")
        def entity = createEntity(adminToken, "Domain Bound Entity")

        // Assign to domain
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/domain", [
                        businessDomainKey: domain.key
                ]).bearerAuth(adminToken), Map
        )

        when: "deleting the domain"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${domain.key}").bearerAuth(adminToken)
        )

        then: "entity still exists but domain is null"
        def entityResp = client.toBlocking().exchange(
                HttpRequest.GET("/business-entities/${entity.key}").bearerAuth(adminToken), Map
        )
        entityResp.body().businessDomain == null
    }
}
