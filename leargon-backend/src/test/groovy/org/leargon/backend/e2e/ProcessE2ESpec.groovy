package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class ProcessE2ESpec extends AbstractE2ESpec {

    // =====================
    // CREATE
    // =====================

    def "should create process with name-based key"() {
        given:
        def token = signup("proc-create@example.com", "proccreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes", [
                        names: [[locale: "en", text: "Order Fulfillment"]]
                ]).bearerAuth(token), Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "order-fulfillment"
        response.body().processOwner.username == "proccreate"
    }

    def "should create process with code-based key"() {
        given:
        def token = signup("proc-code@example.com", "proccode")

        when:
        def proc = createProcess(token, "Order Fulfillment", [code: "ORD-FULFILL"])

        then:
        proc.key == "ord-fulfill"
        proc.code == "ORD-FULFILL"
    }

    def "should create process with type and descriptions"() {
        given:
        def token = signup("proc-full@example.com", "procfull")

        when:
        def proc = createProcess(token, "Customer Onboarding", [
                descriptions: [[locale: "en", text: "Onboarding process"]],
                processType : "OPERATIONAL_CORE"
        ])

        then:
        proc.processType == "OPERATIONAL_CORE"
        proc.descriptions.size() == 1
    }

    def "should reject process creation without default locale"() {
        given:
        def token = signup("proc-noloc@example.com", "procnoloc")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/processes", [
                        names: [[locale: "de", text: "Nur Deutsch"]]
                ]).bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    // =====================
    // READ
    // =====================

    def "should list all processes"() {
        given:
        def token = signup("proc-list@example.com", "proclist")
        createProcess(token, "Process A")
        createProcess(token, "Process B")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 2
    }

    def "should get process by key"() {
        given:
        def token = signup("proc-get@example.com", "procget")
        def proc = createProcess(token, "Gettable Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${proc.key}").bearerAuth(token), Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == proc.key
    }

    def "should return 404 for non-existent process"() {
        given:
        def token = signup("proc-404@example.com", "proc404")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/processes/nonexistent").bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // UPDATE
    // =====================

    def "should update process names and recompute key when no code"() {
        given:
        def token = signup("proc-upname@example.com", "procupname")
        def proc = createProcess(token, "Old Name")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/names", [
                        [locale: "en", text: "New Name"]
                ]).bearerAuth(token), Map
        )

        then:
        response.body().key == "new-name"
        response.body().names[0].text == "New Name"
    }

    def "should update process descriptions"() {
        given:
        def token = signup("proc-updesc@example.com", "procupdesc")
        def proc = createProcess(token, "Desc Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/descriptions", [
                        [locale: "en", text: "A great description"]
                ]).bearerAuth(token), Map
        )

        then:
        response.body().descriptions.size() == 1
        response.body().descriptions[0].text == "A great description"
    }

    def "should update process type"() {
        given:
        def token = signup("proc-uptype@example.com", "procuptype")
        def proc = createProcess(token, "Type Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/type", [processType: "MANAGEMENT"])
                        .bearerAuth(token), Map
        )

        then:
        response.body().processType == "MANAGEMENT"
    }

    def "should update process owner"() {
        given:
        def token = signup("proc-upowner@example.com", "procupowner")
        signup("proc-newowner@example.com", "procnewowner")
        def proc = createProcess(token, "Owner Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/owner", [processOwnerUsername: "procnewowner"])
                        .bearerAuth(token), Map
        )

        then:
        response.body().processOwner.username == "procnewowner"
    }

    def "should update process code and recompute key"() {
        given:
        def token = signup("proc-upcode@example.com", "procupcode")
        def proc = createProcess(token, "Code Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/code", [code: "NEW-CODE"])
                        .bearerAuth(token), Map
        )

        then:
        response.body().key == "new-code"
        response.body().code == "NEW-CODE"
    }

    // =====================
    // BUSINESS DOMAIN
    // =====================

    def "should assign and unassign business domain"() {
        given:
        def adminToken = signupAdmin("proc-dom@example.com", "procdom")
        def proc = createProcess(adminToken, "Domain Process")
        def domain = createDomain(adminToken, "Test Domain")

        when: "assigning domain"
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/domain", [businessDomainKey: domain.key])
                        .bearerAuth(adminToken), Map
        )

        then:
        response.body().businessDomain.key == domain.key

        when: "unassigning domain"
        def response2 = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/domain", [businessDomainKey: null])
                        .bearerAuth(adminToken), Map
        )

        then:
        response2.body().businessDomain == null
    }

    // =====================
    // INPUT/OUTPUT ENTITIES
    // =====================

    def "should add existing entity as input"() {
        given:
        def token = signup("proc-input@example.com", "procinput")
        def proc = createProcess(token, "Input Process")
        def entity = createEntity(token, "Input Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/inputs", [entityKey: entity.key])
                        .bearerAuth(token), Map
        )

        then:
        response.body().inputEntities.size() == 1
        response.body().inputEntities[0].key == entity.key
    }

    def "should add entity on-the-fly as input"() {
        given:
        def token = signup("proc-otfinp@example.com", "procotfinp")
        def proc = createProcess(token, "OTF Input Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/inputs", [
                        createEntity: [names: [[locale: "en", text: "New Entity"]]]
                ]).bearerAuth(token), Map
        )

        then:
        response.body().inputEntities.size() == 1
        response.body().inputEntities[0].name == "New Entity"
    }

    def "should remove input entity"() {
        given:
        def token = signup("proc-rminp@example.com", "procrminp")
        def proc = createProcess(token, "Remove Input Process")
        def entity = createEntity(token, "Removable Entity")

        and: "add input"
        client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/inputs", [entityKey: entity.key])
                        .bearerAuth(token), Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${proc.key}/inputs/${entity.key}")
                        .bearerAuth(token), Map
        )

        then:
        (response.body().inputEntities ?: []).size() == 0
    }

    def "should add existing entity as output"() {
        given:
        def token = signup("proc-output@example.com", "procoutput")
        def proc = createProcess(token, "Output Process")
        def entity = createEntity(token, "Output Entity")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/outputs", [entityKey: entity.key])
                        .bearerAuth(token), Map
        )

        then:
        response.body().outputEntities.size() == 1
        response.body().outputEntities[0].key == entity.key
    }

    def "should remove output entity"() {
        given:
        def token = signup("proc-rmout@example.com", "procrmout")
        def proc = createProcess(token, "Remove Output Process")
        def entity = createEntity(token, "Removable Output")

        and: "add output"
        client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/outputs", [entityKey: entity.key])
                        .bearerAuth(token), Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${proc.key}/outputs/${entity.key}")
                        .bearerAuth(token), Map
        )

        then:
        (response.body().outputEntities ?: []).size() == 0
    }

    // =====================
    // CLASSIFICATIONS
    // =====================

    def "should assign classification to process"() {
        given:
        def adminToken = signupAdmin("proc-cls@example.com", "proccls")
        def classif = createClassification(adminToken, "Process Priority", "BUSINESS_PROCESS", [
                [key: "high", names: [[locale: "en", text: "High"]]],
                [key: "low", names: [[locale: "en", text: "Low"]]]
        ])
        def proc = createProcess(adminToken, "Classified Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/classifications", [
                        [classificationKey: classif.key, valueKey: "high"]
                ]).bearerAuth(adminToken), Map
        )

        then:
        response.body().classificationAssignments.size() == 1
        response.body().classificationAssignments[0].classificationKey == classif.key
        response.body().classificationAssignments[0].valueKey == "high"
    }

    // =====================
    // VERSION HISTORY
    // =====================

    def "should return version history"() {
        given:
        def token = signup("proc-ver@example.com", "procver")
        def proc = createProcess(token, "Versioned Process")

        and: "make some updates"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/type", [processType: "SUPPORT"])
                        .bearerAuth(token), Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${proc.key}/versions").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.body().size() == 2
        response.body()[0].changeType == "TYPE_CHANGE"
        response.body()[1].changeType == "CREATE"
    }

    def "should return version diff"() {
        given:
        def token = signup("proc-diff@example.com", "procdiff")
        def proc = createProcess(token, "Diff Process")

        and: "make an update to generate version 2"
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/type", [processType: "COMPLIANCE"])
                        .bearerAuth(token), Map
        )

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${proc.key}/versions/2/diff").bearerAuth(token), Map
        )

        then:
        response.body().versionNumber == 2
        response.body().previousVersionNumber == 1
        response.body().changes.size() > 0
    }

    // =====================
    // PERMISSIONS
    // =====================

    def "should reject update by non-owner"() {
        given:
        def ownerToken = signup("proc-owner@example.com", "procowner")
        def otherToken = signup("proc-other@example.com", "procother")
        def proc = createProcess(ownerToken, "Protected Process")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/type", [processType: "SUPPORT"])
                        .bearerAuth(otherToken), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should allow admin to update any process"() {
        given:
        def userToken = signup("proc-user2@example.com", "procuser2")
        def adminToken = signupAdmin("proc-admin@example.com", "procadmin")
        def proc = createProcess(userToken, "Admin Edit Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/type", [processType: "INNOVATION"])
                        .bearerAuth(adminToken), Map
        )

        then:
        response.body().processType == "INNOVATION"
    }

    def "should reject delete by non-owner"() {
        given:
        def ownerToken = signup("proc-delown@example.com", "procdelown")
        def otherToken = signup("proc-deloth@example.com", "procdeloth")
        def proc = createProcess(ownerToken, "Delete Protected")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${proc.key}").bearerAuth(otherToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // DELETE
    // =====================

    def "should delete process"() {
        given:
        def token = signup("proc-del@example.com", "procdel")
        def proc = createProcess(token, "Deletable Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${proc.key}").bearerAuth(token)
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        when: "verifying process is gone"
        client.toBlocking().exchange(
                HttpRequest.GET("/processes/${proc.key}").bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // FULL LIFECYCLE
    // =====================

    def "should perform complete process lifecycle"() {
        given:
        def adminToken = signupAdmin("proc-life@example.com", "proclife")

        when: "1. Create process"
        def proc = createProcess(adminToken, "Lifecycle Process", [
                code       : "LC-PROC",
                processType: "OPERATIONAL_CORE"
        ])

        then:
        proc.key == "lc-proc"

        when: "2. Update names"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/names", [
                        [locale: "en", text: "Updated LC Process"],
                        [locale: "de", text: "Aktualisierter LC Prozess"]
                ]).bearerAuth(adminToken), Map
        ).body()

        then: "key stays code-based"
        updated.key == "lc-proc"
        updated.names.size() == 2

        when: "3. Add input entity"
        def entity = createEntity(adminToken, "LC Input Entity")
        client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/inputs", [entityKey: entity.key])
                        .bearerAuth(adminToken), Map
        )

        and: "4. Add output entity on-the-fly"
        def withOutput = client.toBlocking().exchange(
                HttpRequest.POST("/processes/${proc.key}/outputs", [
                        createEntity: [names: [[locale: "en", text: "LC Output Entity"]]]
                ]).bearerAuth(adminToken), Map
        ).body()

        then:
        withOutput.inputEntities.size() == 1
        withOutput.outputEntities.size() == 1

        when: "5. Check version history"
        def versions = client.toBlocking().exchange(
                HttpRequest.GET("/processes/${proc.key}/versions").bearerAuth(adminToken),
                Argument.listOf(Map)
        ).body()

        then:
        versions.size() >= 3

        when: "6. Delete process"
        def delResp = client.toBlocking().exchange(
                HttpRequest.DELETE("/processes/${proc.key}").bearerAuth(adminToken)
        )

        then:
        delResp.status == HttpStatus.NO_CONTENT
    }
}
