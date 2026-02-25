package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class OrganisationalUnitE2ESpec extends AbstractE2ESpec {

    // =====================
    // CREATE
    // =====================

    def "should create org unit with name-based key"() {
        given:
        def token = signupAdmin("ou-create@example.com", "oucreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", [
                        names: [[locale: "en", text: "Engineering"]]
                ]).bearerAuth(token), Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "engineering"
    }

    def "should create org unit with freetext type and descriptions"() {
        given:
        def token = signupAdmin("ou-full@example.com", "oufull")

        when:
        def unit = createOrgUnit(token, "Marketing", [
                unitType    : "Custom Squad",
                descriptions: [[locale: "en", text: "The marketing department"]]
        ])

        then:
        unit.unitType == "Custom Squad"
        unit.descriptions.size() == 1
        unit.descriptions[0].text == "The marketing department"
    }

    def "should reject creation without default locale name"() {
        given:
        def token = signupAdmin("ou-noloc@example.com", "ounoloc")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", [
                        names: [[locale: "de", text: "Nur Deutsch"]]
                ]).bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "should reject creation by non-admin"() {
        given:
        def token = signup("ou-nonadmin@example.com", "ounonadmin")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", [
                        names: [[locale: "en", text: "Forbidden Unit"]]
                ]).bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // READ
    // =====================

    def "should get org unit by key"() {
        given:
        def token = signupAdmin("ou-get@example.com", "ouget")
        def unit = createOrgUnit(token, "Gettable Unit")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/${unit.key}").bearerAuth(token), Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().key == unit.key
    }

    def "should list all org units"() {
        given:
        def token = signupAdmin("ou-list@example.com", "oulist")
        createOrgUnit(token, "Unit A")
        createOrgUnit(token, "Unit B")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 2
    }

    def "should get tree with parent-child hierarchy"() {
        given:
        def token = signupAdmin("ou-tree@example.com", "outree")
        def parent = createOrgUnit(token, "Parent Department")
        createOrgUnit(token, "Child Team", [parentKeys: [parent.key]])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/tree").bearerAuth(token),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        def parentNode = response.body().find { it.key == parent.key }
        parentNode != null
        parentNode.children.size() == 1
    }

    def "should return 404 for non-existent org unit"() {
        given:
        def token = signupAdmin("ou-404@example.com", "ou404")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/nonexistent").bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // UPDATE
    // =====================

    def "should update org unit names and recompute key"() {
        given:
        def token = signupAdmin("ou-upname@example.com", "ouupname")
        def unit = createOrgUnit(token, "Old Name")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/names", [
                        [locale: "en", text: "New Name"]
                ]).bearerAuth(token), Map
        )

        then:
        response.body().key == "new-name"
        response.body().names[0].text == "New Name"
    }

    def "should update org unit descriptions"() {
        given:
        def token = signupAdmin("ou-updesc@example.com", "ouupdesc")
        def unit = createOrgUnit(token, "Desc Unit")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/descriptions", [
                        [locale: "en", text: "Updated description"]
                ]).bearerAuth(token), Map
        )

        then:
        response.body().descriptions.size() == 1
        response.body().descriptions[0].text == "Updated description"
    }

    def "should update org unit type with freetext"() {
        given:
        def token = signupAdmin("ou-uptype@example.com", "ouuptype")
        def unit = createOrgUnit(token, "Type Unit")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/type", [unitType: "Innovation Lab"])
                        .bearerAuth(token), Map
        )

        then:
        response.body().unitType == "Innovation Lab"
    }

    def "should update org unit lead"() {
        given:
        def token = signupAdmin("ou-uplead@example.com", "ouuplead")
        signup("ou-newlead@example.com", "ounewlead")
        def unit = createOrgUnit(token, "Lead Unit")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/lead", [leadUsername: "ounewlead"])
                        .bearerAuth(token), Map
        )

        then:
        response.body().lead.username == "ounewlead"
    }

    def "should update org unit parents"() {
        given:
        def token = signupAdmin("ou-uppar@example.com", "ouuppar")
        def parent = createOrgUnit(token, "New Parent")
        def child = createOrgUnit(token, "Reparented Child")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${child.key}/parents", [keys: [parent.key]])
                        .bearerAuth(token), Map
        )

        then:
        response.body().parents.size() == 1
        response.body().parents[0].key == parent.key
    }

    def "should reject self-parent"() {
        given:
        def token = signupAdmin("ou-selfpar@example.com", "ouselfpar")
        def unit = createOrgUnit(token, "Self Parent Unit")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/parents", [keys: [unit.key]])
                        .bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.BAD_REQUEST
    }

    def "should reject update by non-admin non-lead"() {
        given:
        def adminToken = signupAdmin("ou-updadm@example.com", "ouupdadm")
        def userToken = signup("ou-upduser@example.com", "ouupduser")
        def unit = createOrgUnit(adminToken, "Protected Unit")

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/type", [unitType: "Hacked"])
                        .bearerAuth(userToken), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should allow lead to update their unit"() {
        given:
        def adminToken = signupAdmin("ou-leadup@example.com", "ouleadup")
        def leadToken = signup("ou-lead@example.com", "oulead")
        def unit = createOrgUnit(adminToken, "Lead Editable Unit", [leadUsername: "oulead"])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/type", [unitType: "Lead Updated Type"])
                        .bearerAuth(leadToken), Map
        )

        then:
        response.body().unitType == "Lead Updated Type"
    }

    def "should allow lead to create child unit under their unit"() {
        given:
        def adminToken = signupAdmin("ou-leadcr@example.com", "ouleadcr")
        def leadToken = signup("ou-leadchild@example.com", "ouleadchild")
        def parent = createOrgUnit(adminToken, "Lead Parent Unit", [leadUsername: "ouleadchild"])

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", [
                        names     : [[locale: "en", text: "Lead Child Unit"]],
                        parentKeys: [parent.key]
                ]).bearerAuth(leadToken), Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().key == "lead-child-unit"
        response.body().parents.size() == 1
        response.body().parents[0].key == parent.key
    }

    def "should reject lead creating root unit"() {
        given:
        def adminToken = signupAdmin("ou-leadrt@example.com", "ouleadrt")
        def leadToken = signup("ou-leadroot@example.com", "ouleadroot")
        createOrgUnit(adminToken, "Some Unit", [leadUsername: "ouleadroot"])

        when: "lead tries to create a root unit (no parentKeys)"
        client.toBlocking().exchange(
                HttpRequest.POST("/organisational-units", [
                        names: [[locale: "en", text: "Unauthorized Root"]]
                ]).bearerAuth(leadToken), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // DELETE
    // =====================

    def "should delete org unit"() {
        given:
        def token = signupAdmin("ou-del@example.com", "oudel")
        def unit = createOrgUnit(token, "Deletable Unit")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${unit.key}").bearerAuth(token)
        )

        then:
        response.status == HttpStatus.NO_CONTENT

        when: "verifying unit is gone"
        client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/${unit.key}").bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    def "should reject delete by non-admin non-lead"() {
        given:
        def adminToken = signupAdmin("ou-deladm@example.com", "oudeladm")
        def userToken = signup("ou-deluser@example.com", "oudeluser")
        def unit = createOrgUnit(adminToken, "No Delete Unit")

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${unit.key}").bearerAuth(userToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // CROSS-FEATURE: EXECUTING UNITS
    // =====================

    def "should assign org unit as executing unit to a process"() {
        given:
        def token = signupAdmin("ou-exec@example.com", "ouexec")
        def unit = createOrgUnit(token, "Executing Dept")
        def proc = createProcess(token, "Executed Process")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/processes/${proc.key}/executing-units", [keys: [unit.key]])
                        .bearerAuth(token), Map
        )

        then:
        response.body().executingUnits.size() == 1
        response.body().executingUnits[0].key == unit.key
    }

    // =====================
    // FULL LIFECYCLE
    // =====================

    def "should perform complete org unit lifecycle"() {
        given:
        def adminToken = signupAdmin("ou-life@example.com", "oulife")

        when: "1. Create org unit"
        def unit = createOrgUnit(adminToken, "Lifecycle Unit", [
                unitType    : "Department",
                descriptions: [[locale: "en", text: "Initial description"]]
        ])

        then:
        unit.key == "lifecycle-unit"
        unit.unitType == "Department"

        when: "2. Update names"
        def updated = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${unit.key}/names", [
                        [locale: "en", text: "Updated Lifecycle Unit"],
                        [locale: "de", text: "Aktualisierte Einheit"]
                ]).bearerAuth(adminToken), Map
        ).body()

        then:
        updated.key == "updated-lifecycle-unit"
        updated.names.size() == 2

        when: "3. Update type to freetext"
        def withType = client.toBlocking().exchange(
                HttpRequest.PUT("/organisational-units/${updated.key}/type", [unitType: "Innovation Hub"])
                        .bearerAuth(adminToken), Map
        ).body()

        then:
        withType.unitType == "Innovation Hub"

        when: "4. Add child unit"
        def child = createOrgUnit(adminToken, "Child of Lifecycle", [parentKeys: [updated.key]])

        then:
        child.parents.size() == 1
        child.parents[0].key == updated.key

        when: "5. Verify tree"
        def tree = client.toBlocking().exchange(
                HttpRequest.GET("/organisational-units/tree").bearerAuth(adminToken),
                Argument.listOf(Map)
        ).body()
        def parentNode = tree.find { it.key == updated.key }

        then:
        parentNode != null
        parentNode.children.size() == 1

        when: "6. Delete child first, then parent"
        client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${child.key}").bearerAuth(adminToken)
        )
        def delResp = client.toBlocking().exchange(
                HttpRequest.DELETE("/organisational-units/${updated.key}").bearerAuth(adminToken)
        )

        then:
        delResp.status == HttpStatus.NO_CONTENT
    }
}
