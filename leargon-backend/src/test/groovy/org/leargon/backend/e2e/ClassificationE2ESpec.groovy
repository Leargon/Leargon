package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class ClassificationE2ESpec extends AbstractE2ESpec {

    // =====================
    // CREATE
    // =====================

    def "should create classification with values as admin"() {
        given:
        def adminToken = signupAdmin("cls-create@example.com", "clscreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications", [
                        names       : [[locale: "en", text: "Data Sensitivity"]],
                        descriptions: [[locale: "en", text: "Data sensitivity levels"]],
                        assignableTo: "BUSINESS_ENTITY",
                        values      : [
                                [key: "public", names: [[locale: "en", text: "Public"]]],
                                [key: "internal", names: [[locale: "en", text: "Internal"]]],
                                [key: "confidential", names: [[locale: "en", text: "Confidential"]]]
                        ]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key != null
        response.body().names.size() == 1
        response.body().values.size() == 3
        response.body().assignableTo == "BUSINESS_ENTITY"
    }

    def "should create entity-only classification"() {
        given:
        def adminToken = signupAdmin("cls-entity@example.com", "clsentity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications", [
                        names       : [[locale: "en", text: "Entity Only Class"]],
                        assignableTo: "BUSINESS_ENTITY",
                        values      : [
                                [key: "val1", names: [[locale: "en", text: "Value 1"]]]
                        ]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().assignableTo == "BUSINESS_ENTITY"
    }

    def "should create domain-only classification"() {
        given:
        def adminToken = signupAdmin("cls-domain@example.com", "clsdomain")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications", [
                        names       : [[locale: "en", text: "Domain Only Class"]],
                        assignableTo: "BUSINESS_DOMAIN",
                        values      : [
                                [key: "val1", names: [[locale: "en", text: "Value 1"]]]
                        ]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.body().assignableTo == "BUSINESS_DOMAIN"
    }

    def "should reject classification creation by non-admin"() {
        given:
        def userToken = signup("cls-nonadmin@example.com", "clsnonadmin")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications", [
                        names       : [[locale: "en", text: "Unauthorized"]],
                        assignableTo: "BUSINESS_ENTITY",
                        values      : []
                ]).bearerAuth(userToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // READ
    // =====================

    def "should list all classifications"() {
        given:
        def adminToken = signupAdmin("cls-list@example.com", "clslist")
        createClassification(adminToken, "List Class A", "BUSINESS_ENTITY")
        createClassification(adminToken, "List Class B", "BUSINESS_ENTITY")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 2
    }

    def "should get classification by key"() {
        given:
        def adminToken = signupAdmin("cls-get@example.com", "clsget")
        def classif = createClassification(adminToken, "Gettable Class", "BUSINESS_ENTITY", [
                [key: "v1", names: [[locale: "en", text: "V1"]]]
        ])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${classif.key}").bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == classif.key
        response.body().values.size() == 1
    }

    def "should filter classifications by assignable-to"() {
        given:
        def adminToken = signupAdmin("cls-filter@example.com", "clsfilter")
        createClassification(adminToken, "Filter Entity", "BUSINESS_ENTITY")
        createClassification(adminToken, "Filter Domain", "BUSINESS_DOMAIN")

        when: "filtering for ENTITY"
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/classifications?assignable-to=ENTITY").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().every { it.assignableTo == "BUSINESS_ENTITY" || it.assignableTo == "BUSINESS_ENTITY" }
    }

    // =====================
    // UPDATE CLASSIFICATION
    // =====================

    def "should update classification names and descriptions"() {
        given:
        def adminToken = signupAdmin("cls-update@example.com", "clsupdate")
        def classif = createClassification(adminToken, "Updatable Class", "BUSINESS_ENTITY")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${classif.key}", [
                        names       : [
                                [locale: "en", text: "Updated Class Name"],
                                [locale: "de", text: "Aktualisierte Klasse"]
                        ],
                        descriptions: [
                                [locale: "en", text: "Updated description"]
                        ]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().names.size() == 2
        response.body().names.any { it.locale == "en" && it.text == "Updated Class Name" }
        response.body().descriptions.size() == 1
    }

    // =====================
    // CLASSIFICATION VALUES CRUD
    // =====================

    def "should add a value to existing classification"() {
        given:
        def adminToken = signupAdmin("cls-addval@example.com", "clsaddval")
        def classif = createClassification(adminToken, "Addable Class", "BUSINESS_ENTITY", [
                [key: "existing", names: [[locale: "en", text: "Existing"]]]
        ])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classif.key}/values", [
                        key  : "newval",
                        names: [[locale: "en", text: "New Value"]]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
    }

    def "should update a classification value"() {
        given:
        def adminToken = signupAdmin("cls-upval@example.com", "clsupval")
        def classif = createClassification(adminToken, "Val Update Class", "BUSINESS_ENTITY", [
                [key: "updval", names: [[locale: "en", text: "Original Value"]]]
        ])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${classif.key}/values/updval", [
                        names      : [
                                [locale: "en", text: "Updated Value"],
                                [locale: "de", text: "Aktualisierter Wert"]
                        ],
                        descriptions: [[locale: "en", text: "Value description"]]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
    }

    def "should delete a classification value"() {
        given:
        def adminToken = signupAdmin("cls-delval@example.com", "clsdelval")
        def classif = createClassification(adminToken, "Val Delete Class", "BUSINESS_ENTITY", [
                [key: "keep", names: [[locale: "en", text: "Keep"]]],
                [key: "remove", names: [[locale: "en", text: "Remove"]]]
        ])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classif.key}/values/remove")
                        .bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        when: "verifying value is removed"
        def getResp = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${classif.key}").bearerAuth(adminToken),
                Map
        )

        then:
        getResp.body().values.size() == 1
        getResp.body().values[0].key == "keep"
    }

    // =====================
    // DELETE CLASSIFICATION
    // =====================

    def "should delete classification as admin"() {
        given:
        def adminToken = signupAdmin("cls-del@example.com", "clsdel")
        def classif = createClassification(adminToken, "Deletable Class", "BUSINESS_ENTITY")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classif.key}").bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.NO_CONTENT
    }

    def "should reject classification delete by non-admin"() {
        given:
        def adminToken = signupAdmin("cls-del2@example.com", "clsdel2")
        def classif = createClassification(adminToken, "Protected Class", "BUSINESS_ENTITY")
        def userToken = signup("cls-deluser@example.com", "clsdeluser")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classif.key}").bearerAuth(userToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // ASSIGNMENT TO ENTITY AND DOMAIN
    // =====================

    def "should assign classification to entity and domain separately"() {
        given:
        def adminToken = signupAdmin("cls-both@example.com", "clsboth")
        def entityClassif = createClassification(adminToken, "Entity Class", "BUSINESS_ENTITY", [
                [key: "yes", names: [[locale: "en", text: "Yes"]]]
        ])
        def domainClassif = createClassification(adminToken, "Domain Class", "BUSINESS_DOMAIN", [
                [key: "no", names: [[locale: "en", text: "No"]]]
        ])
        def entity = createEntity(adminToken, "Both Entity")
        def domain = createDomain(adminToken, "Both Domain")

        when: "assigning entity classification to entity"
        def entityResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-entities/${entity.key}/classifications", [
                        [classificationKey: entityClassif.key, valueKey: "yes"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        entityResp.body().classificationAssignments.size() == 1

        when: "assigning domain classification to domain"
        def domainResp = client.toBlocking().exchange(
                HttpRequest.PUT("/business-domains/${domain.key}/classifications", [
                        [classificationKey: domainClassif.key, valueKey: "no"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        domainResp.body().classificationAssignments.size() == 1
    }

    // =====================
    // FULL LIFECYCLE
    // =====================

    def "should perform complete classification lifecycle"() {
        given:
        def adminToken = signupAdmin("cls-life@example.com", "clslife")

        when: "1. Create classification"
        def classif = createClassification(adminToken, "Lifecycle Class", "BUSINESS_ENTITY", [
                [key: "lc1", names: [[locale: "en", text: "LC Value 1"]]]
        ])

        then:
        classif.key != null

        when: "2. Update classification"
        client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${classif.key}", [
                        names   : [[locale: "en", text: "Updated LC Class"]]
                ]).bearerAuth(adminToken), Map
        )

        and: "3. Add value"
        client.toBlocking().exchange(
                HttpRequest.POST("/classifications/${classif.key}/values", [
                        key  : "lc2",
                        names: [[locale: "en", text: "LC Value 2"]]
                ]).bearerAuth(adminToken), Map
        )

        and: "4. Update value"
        client.toBlocking().exchange(
                HttpRequest.PUT("/classifications/${classif.key}/values/lc1", [
                        names: [[locale: "en", text: "Updated LC Value 1"]]
                ]).bearerAuth(adminToken), Map
        )

        then: "verify state"
        def getResp = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${classif.key}").bearerAuth(adminToken), Map
        )
        getResp.body().values.size() == 2

        when: "5. Delete a value"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classif.key}/values/lc2").bearerAuth(adminToken)
        )

        then: "one value remains"
        def getResp2 = client.toBlocking().exchange(
                HttpRequest.GET("/classifications/${classif.key}").bearerAuth(adminToken), Map
        )
        getResp2.body().values.size() == 1

        when: "6. Delete classification"
        def delResp = client.toBlocking().exchange(
                HttpRequest.DELETE("/classifications/${classif.key}").bearerAuth(adminToken)
        )

        then:
        delResp.status == HttpStatus.NO_CONTENT
    }
}
