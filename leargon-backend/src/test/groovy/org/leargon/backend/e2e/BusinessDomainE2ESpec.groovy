package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class BusinessDomainE2ESpec extends AbstractE2ESpec {

    // =====================
    // CREATE
    // =====================

    def "should create domain as admin"() {
        given:
        def adminToken = signupAdmin("dom-create@example.com", "domcreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
                        names: [
                                [locale: "en", text: "Sales"],
                                [locale: "de", text: "Vertrieb"]
                        ]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "sales"
        response.body().names.size() == 2
        response.body().names.any { it.locale == "en" && it.text == "Sales" }
        response.body().names.any { it.locale == "de" && it.text == "Vertrieb" }
    }

    def "should create domain with type"() {
        given:
        def adminToken = signupAdmin("dom-type@example.com", "domtype")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
                        names: [[locale: "en", text: "Core Services"]],
                        type : "CORE"
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().type == "CORE"
        response.body().effectiveType == "CORE"
    }

    def "should create subdomain with parent"() {
        given:
        def adminToken = signupAdmin("dom-sub@example.com", "domsub")
        def parent = createDomain(adminToken, "Sales")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
                        names    : [[locale: "en", text: "B2B Sales"]],
                        parentKey: parent.key
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().parent.key == parent.key
        response.body().key == "sales.b2b-sales"
    }

    def "should reject domain creation by non-admin"() {
        given:
        def userToken = signup("dom-nonadmin@example.com", "domnonadmin")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
                        names: [[locale: "en", text: "Unauthorized Domain"]]
                ]).bearerAuth(userToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject domain creation without default locale"() {
        given:
        def adminToken = signupAdmin("dom-noen@example.com", "domnoen")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
                        names: [[locale: "de", text: "Nur Deutsch"]]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "should reject domain creation without authentication"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/business-domains", [
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

    def "should get domain by key"() {
        given:
        def adminToken = signupAdmin("dom-get@example.com", "domget")
        def domain = createDomain(adminToken, "Readable Domain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${domain.key}").bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == domain.key
    }

    def "should return 404 for non-existent domain"() {
        given:
        def token = signup("dom-404@example.com", "dom404")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/nonexistent").bearerAuth(token),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    def "should list all domains"() {
        given:
        def adminToken = signupAdmin("dom-list@example.com", "domlist")
        createDomain(adminToken, "Domain A")
        createDomain(adminToken, "Domain B")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 2
    }

    def "should get domain tree with hierarchy"() {
        given:
        def adminToken = signupAdmin("dom-tree@example.com", "domtree")
        def parent = createDomain(adminToken, "Tree Parent")
        createDomain(adminToken, "Tree Child", [parentKey: parent.key])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/tree").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().any { it.key == parent.key && it.children?.size() >= 1 }
    }

    // =====================
    // UPDATE NAMES
    // =====================

    def "should update domain names as admin"() {
        given:
        def adminToken = signupAdmin("dom-upname@example.com", "domupname")
        def domain = createDomain(adminToken, "Original Name")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/names", [
                        [locale: "en", text: "Updated Name"],
                        [locale: "de", text: "Aktualisiert"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().names.size() == 2
        response.body().names.any { it.locale == "en" && it.text == "Updated Name" }
    }

    def "should reject name update by non-admin"() {
        given:
        def adminToken = signupAdmin("dom-upname2@example.com", "domupname2")
        def domain = createDomain(adminToken, "Admin Domain")
        def userToken = signup("dom-nameuser@example.com", "domnameuser")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/names", [
                        [locale: "en", text: "Unauthorized"]
                ]).bearerAuth(userToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // UPDATE DESCRIPTIONS
    // =====================

    def "should update domain descriptions"() {
        given:
        def adminToken = signupAdmin("dom-desc@example.com", "domdesc")
        def domain = createDomain(adminToken, "Desc Domain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/descriptions", [
                        [locale: "en", text: "Domain description"],
                        [locale: "de", text: "Domänenbeschreibung"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().descriptions.size() == 2
    }

    // =====================
    // UPDATE TYPE
    // =====================

    def "should update domain type"() {
        given:
        def adminToken = signupAdmin("dom-uptype@example.com", "domuptype")
        def domain = createDomain(adminToken, "Typed Domain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/type", [
                        type: "GENERIC"
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().type == "GENERIC"
        response.body().effectiveType == "GENERIC"
    }

    // =====================
    // UPDATE PARENT
    // =====================

    def "should change domain parent"() {
        given:
        def adminToken = signupAdmin("dom-reparent@example.com", "domreparent")
        def parent1 = createDomain(adminToken, "Parent One")
        def parent2 = createDomain(adminToken, "Parent Two")
        def child = createDomain(adminToken, "Reparent Child", [parentKey: parent1.key])

        when: "moving child to parent2"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${child.key}/parent", [
                        parentKey: parent2.key
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().parent.key == parent2.key
    }

    def "should reject parent change that creates a cycle"() {
        given:
        def adminToken = signupAdmin("dom-cycle@example.com", "domcycle")
        def parent = createDomain(adminToken, "Cycle Parent")
        def child = createDomain(adminToken, "Cycle Child", [parentKey: parent.key])

        when: "trying to set parent's parent to child (creating cycle)"
        client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${parent.key}/parent", [
                        parentKey: child.key
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // CLASSIFICATIONS
    // =====================

    def "should assign classifications to domain"() {
        given:
        def adminToken = signupAdmin("dom-classif@example.com", "domclassif")
        def classif = createClassification(adminToken, "Domain Sensitivity", "BUSINESS_DOMAIN", [
                [key: "public", names: [[locale: "en", text: "Public"]]],
                [key: "private", names: [[locale: "en", text: "Private"]]]
        ])
        def domain = createDomain(adminToken, "Classified Domain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/classifications", [
                        [classificationKey: classif.key, valueKey: "public"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().classificationAssignments.size() == 1
        response.body().classificationAssignments[0].classificationKey == classif.key
        response.body().classificationAssignments[0].valueKey == "public"
    }

    // =====================
    // VERSION HISTORY
    // =====================

    def "should track domain version history through create and updates"() {
        given:
        def adminToken = signupAdmin("dom-ver@example.com", "domver")
        def domain = createDomain(adminToken, "Versioned Domain")

        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/names", [
                        [locale: "en", text: "Updated Versioned"]
                ]).bearerAuth(adminToken),
                Map
        )
        def updatedKey = updateResponse.body().key

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${updatedKey}/versions").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.body().size() == 2
        response.body().any { it.versionNumber == 1 && it.changeType == "CREATE" }
        response.body().any { it.versionNumber == 2 && it.changeType == "UPDATE" }
    }

    def "should return domain version diff"() {
        given:
        def adminToken = signupAdmin("dom-diff@example.com", "domdiff")
        def domain = createDomain(adminToken, "Diffable Domain")

        def updateResponse = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/names", [
                        [locale: "en", text: "Modified Domain"]
                ]).bearerAuth(adminToken),
                Map
        )
        def updatedKey = updateResponse.body().key

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${updatedKey}/versions/2/diff").bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().versionNumber == 2
        response.body().previousVersionNumber == 1
        response.body().changes.size() > 0
    }

    // =====================
    // DELETE
    // =====================

    def "should delete domain as admin"() {
        given:
        def adminToken = signupAdmin("dom-del@example.com", "domdel")
        def domain = createDomain(adminToken, "Deletable Domain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${domain.key}").bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        when: "verifying domain is gone"
        client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${domain.key}").bearerAuth(adminToken), Map
        )

        then:
        thrown(HttpClientResponseException)
    }

    def "should reject delete by non-admin"() {
        given:
        def adminToken = signupAdmin("dom-del2@example.com", "domdel2")
        def domain = createDomain(adminToken, "Protected Domain")
        def userToken = signup("dom-deluser@example.com", "domdeluser")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${domain.key}").bearerAuth(userToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should return 404 when deleting non-existent domain"() {
        given:
        def adminToken = signupAdmin("dom-del404@example.com", "domdel404")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/nonexistent").bearerAuth(adminToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    def "should detach child domains when parent is deleted"() {
        given:
        def adminToken = signupAdmin("dom-detach@example.com", "domdetach")
        def parent = createDomain(adminToken, "Detach Parent")
        createDomain(adminToken, "Detach Child", [parentKey: parent.key])

        when: "deleting parent"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${parent.key}").bearerAuth(adminToken)
        )

        then: "child still exists with no parent and recomputed key"
        def childResp = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/detach-child").bearerAuth(adminToken),
                Map
        )
        childResp.status == HttpStatus.OK
        childResp.body().parent == null
        childResp.body().key == "detach-child"
    }

    // =====================
    // FULL LIFECYCLE
    // =====================

    def "should perform complete domain lifecycle with all update operations"() {
        given:
        def adminToken = signupAdmin("dom-life@example.com", "domlife")
        def classif = createClassification(adminToken, "Domain LC Class", "BUSINESS_DOMAIN", [
                [key: "x", names: [[locale: "en", text: "X"]]]
        ])

        when: "1. Create domain"
        def domain = createDomain(adminToken, "Lifecycle Domain")
        def key = domain.key

        then:
        key == "lifecycle-domain"

        when: "2. Update names"
        def namesResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${key}/names", [
                        [locale: "en", text: "Updated LC Domain"],
                        [locale: "de", text: "LC Domäne"]
                ]).bearerAuth(adminToken), Map
        )
        key = namesResp.body().key

        then:
        namesResp.body().names.size() == 2

        when: "3. Update descriptions"
        def descResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${key}/descriptions", [
                        [locale: "en", text: "LC description"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        descResp.body().descriptions.size() == 1

        when: "4. Set type"
        def typeResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${key}/type", [type: "SUPPORT"])
                        .bearerAuth(adminToken), Map
        )

        then:
        typeResp.body().type == "SUPPORT"

        when: "5. Assign classification"
        def classResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${key}/classifications", [
                        [classificationKey: classif.key, valueKey: "x"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        classResp.body().classificationAssignments.size() == 1

        when: "6. Verify version history"
        def versResp = client.toBlocking().exchange(
                HttpRequest.GET("/business-domains/${key}/versions").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        versResp.body().size() >= 2

        when: "7. Delete"
        def delResp = client.toBlocking().exchange(
                HttpRequest.DELETE("/business-domains/${key}").bearerAuth(adminToken)
        )

        then:
        delResp.status == HttpStatus.NO_CONTENT
    }
}
