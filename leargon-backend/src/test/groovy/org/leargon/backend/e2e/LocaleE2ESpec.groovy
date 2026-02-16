package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class LocaleE2ESpec extends AbstractE2ESpec {

    // =====================
    // LIST LOCALES
    // =====================

    def "should list seeded locales"() {
        given:
        def token = signup("loc-list@example.com", "loclist")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/locales").bearerAuth(token),
                Argument.listOf(Map)
        )

        then: "en and de are seeded by Liquibase"
        response.status == HttpStatus.OK
        def locales = response.body()
        locales.size() >= 2
        locales.any { it.localeCode == "en" && it.isDefault == true }
        locales.any { it.localeCode == "de" }
    }

    // =====================
    // CREATE LOCALE (admin)
    // =====================

    def "should create a new locale as admin"() {
        given:
        def adminToken = signupAdmin("loc-create@example.com", "loccreate")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/locales", [
                        localeCode : "fr",
                        displayName: "French",
                        isActive   : true,
                        sortOrder  : 3
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().localeCode == "fr"
        response.body().displayName == "French"
    }

    def "should reject locale creation by non-admin"() {
        given:
        def userToken = signup("loc-nonadmin@example.com", "locnonadmin")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/locales", [
                        localeCode : "es",
                        displayName: "Spanish",
                        isActive   : true,
                        sortOrder  : 4
                ]).bearerAuth(userToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // UPDATE LOCALE (admin)
    // =====================

    def "should update locale display name"() {
        given:
        def adminToken = signupAdmin("loc-update@example.com", "locupdate")

        // Create a locale to update
        def createResp = client.toBlocking().exchange(
                HttpRequest.POST("/locales", [
                        localeCode : "it",
                        displayName: "Italian",
                        isActive   : true,
                        sortOrder  : 5
                ]).bearerAuth(adminToken),
                Map
        )
        def localeId = createResp.body().id

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/locales/${localeId}", [
                        displayName: "Italiano",
                        isActive   : true,
                        sortOrder  : 10
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().displayName == "Italiano"
        response.body().sortOrder == 10
    }

    // =====================
    // DELETE LOCALE (admin)
    // =====================

    def "should delete a non-default locale"() {
        given:
        def adminToken = signupAdmin("loc-del@example.com", "locdel")

        def createResp = client.toBlocking().exchange(
                HttpRequest.POST("/locales", [
                        localeCode : "pt",
                        displayName: "Portuguese",
                        isActive   : true,
                        sortOrder  : 6
                ]).bearerAuth(adminToken),
                Map
        )
        def localeId = createResp.body().id

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/locales/${localeId}").bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.NO_CONTENT
    }

    // =====================
    // TRANSLATION VALIDATION
    // =====================

    def "should reject entity creation without default locale translation"() {
        given:
        def token = signup("loc-validate@example.com", "locvalidate")

        when: "creating entity with only German name"
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

    def "should accept entity creation with default locale and additional locales"() {
        given:
        def token = signup("loc-valid@example.com", "locvalid")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/business-entities", [
                        names: [
                                [locale: "en", text: "English Name"],
                                [locale: "de", text: "German Name"]
                        ]
                ]).bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.CREATED
        response.body().names.size() == 2
    }

    def "should reject domain creation without default locale translation"() {
        given:
        def adminToken = signupAdmin("loc-domval@example.com", "locdomval")

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
}
