package org.leargon.backend.e2e

import io.micronaut.core.type.Argument
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class AdministrationE2ESpec extends AbstractE2ESpec {

    // =====================
    // LIST USERS
    // =====================

    def "should list all users as admin"() {
        given:
        def adminToken = signupAdmin("adm-list@example.com", "admlist")
        signup("adm-user1@example.com", "admuser1")
        signup("adm-user2@example.com", "admuser2")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/users").bearerAuth(adminToken),
                Argument.listOf(Map)
        )

        then:
        response.status == HttpStatus.OK
        response.body().size() >= 3
    }

    def "should reject user list by non-admin"() {
        given:
        def userToken = signup("adm-nonadmin@example.com", "admnonadmin")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users").bearerAuth(userToken),
                Argument.listOf(Map)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject user list without authentication"() {
        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users"),
                Argument.listOf(Map)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.UNAUTHORIZED
    }

    // =====================
    // GET USER
    // =====================

    def "should get user by id as admin"() {
        given:
        def adminToken = signupAdmin("adm-getuser@example.com", "admgetuser")
        def user = userRepository.findByEmail("adm-getuser@example.com").get()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.GET("/administration/users/${user.id}").bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().email == "adm-getuser@example.com"
        response.body().roles.contains("ROLE_ADMIN")
    }

    def "should return 404 for non-existent user"() {
        given:
        def adminToken = signupAdmin("adm-404user@example.com", "adm404user")

        when:
        client.toBlocking().exchange(
                HttpRequest.GET("/administration/users/999999").bearerAuth(adminToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.NOT_FOUND
    }

    // =====================
    // UPDATE USER
    // =====================

    def "should update user details as admin"() {
        given:
        def adminToken = signupAdmin("adm-update@example.com", "admupdate")
        signup("adm-target@example.com", "admtarget")
        def target = userRepository.findByEmail("adm-target@example.com").get()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${target.id}", [
                        firstName: "Updated",
                        lastName : "Name"
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().firstName == "Updated"
        response.body().lastName == "Name"
    }

    def "should promote user to admin"() {
        given:
        def adminToken = signupAdmin("adm-promote@example.com", "admpromote")
        signup("adm-promo-target@example.com", "admpromotarget")
        def target = userRepository.findByEmail("adm-promo-target@example.com").get()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${target.id}", [
                        roles: ["USER", "ADMIN"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().roles.contains("ROLE_ADMIN")
        response.body().roles.contains("ROLE_USER")
    }

    def "should demote admin to regular user"() {
        given:
        def adminToken = signupAdmin("adm-demote@example.com", "admdemote")
        signup("adm-demote-target@example.com", "admdemtarget")
        def target = userRepository.findByEmail("adm-demote-target@example.com").get()
        target.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(target)

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${target.id}", [
                        roles: ["USER"]
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        !response.body().roles.contains("ROLE_ADMIN")
        response.body().roles.contains("ROLE_USER")
    }

    // =====================
    // DELETE (SOFT-DELETE) USER
    // =====================

    def "should soft-delete user as admin"() {
        given:
        def adminToken = signupAdmin("adm-del@example.com", "admdel")
        signup("adm-deltarget@example.com", "admdeltarget")
        def target = userRepository.findByEmail("adm-deltarget@example.com").get()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.DELETE("/administration/users/${target.id}").bearerAuth(adminToken),
                Map
        )

        then:
        response.status == HttpStatus.OK
        def disabled = userRepository.findByEmail("adm-deltarget@example.com").get()
        !disabled.enabled
    }

    // =====================
    // LOCK / UNLOCK / ENABLE / DISABLE
    // =====================

    def "should lock and unlock user account"() {
        given:
        def adminToken = signupAdmin("adm-lock@example.com", "admlock")
        signup("adm-locktarget@example.com", "admlocktarget")
        def target = userRepository.findByEmail("adm-locktarget@example.com").get()

        when: "locking"
        def lockResp = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${target.id}/lock", "").bearerAuth(adminToken),
                Map
        )

        then:
        lockResp.body().accountLocked == true

        when: "unlocking"
        def unlockResp = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${target.id}/unlock", "").bearerAuth(adminToken),
                Map
        )

        then:
        unlockResp.body().accountLocked == false
    }

    def "should disable and enable user account"() {
        given:
        def adminToken = signupAdmin("adm-enable@example.com", "admenable")
        signup("adm-enabletarget@example.com", "admenabletarget")
        def target = userRepository.findByEmail("adm-enabletarget@example.com").get()

        when: "disabling"
        def disableResp = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${target.id}/disable", "").bearerAuth(adminToken),
                Map
        )

        then:
        disableResp.body().enabled == false

        when: "enabling"
        def enableResp = client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${target.id}/enable", "").bearerAuth(adminToken),
                Map
        )

        then:
        enableResp.body().enabled == true
    }

    // =====================
    // ADMIN PASSWORD CHANGE
    // =====================

    def "should change user password as admin"() {
        given:
        def adminToken = signupAdmin("adm-pwchange@example.com", "admpwchange")
        signup("adm-pwtarget@example.com", "admpwtarget")
        def target = userRepository.findByEmail("adm-pwtarget@example.com").get()

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${target.id}/password", [
                        newPassword: "newadminsetpw123"
                ]).bearerAuth(adminToken)
        )

        then:
        response.status == HttpStatus.OK

        when: "user logs in with new password"
        def newToken = login("adm-pwtarget@example.com", "newadminsetpw123")

        then:
        newToken != null
    }

    // =====================
    // FALLBACK ADMIN PROTECTION
    // =====================

    def "should reject modification of fallback administrator"() {
        given:
        def adminToken = signupAdmin("adm-fbprotect@example.com", "admfbprotect")
        def fbAdmin = userRepository.findByEmail("adm-fbprotect@example.com").get()
        fbAdmin.isFallbackAdministrator = true
        userRepository.update(fbAdmin)

        when: "trying to update fallback admin"
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${fbAdmin.id}", [
                        firstName: "Hacked"
                ]).bearerAuth(adminToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject password change for fallback administrator"() {
        given:
        def adminToken = signupAdmin("adm-fbpw@example.com", "admfbpw")
        def fbAdmin = userRepository.findByEmail("adm-fbpw@example.com").get()
        fbAdmin.isFallbackAdministrator = true
        userRepository.update(fbAdmin)

        when:
        client.toBlocking().exchange(
                HttpRequest.PUT("/administration/users/${fbAdmin.id}/password", [
                        newPassword: "hackedpassword"
                ]).bearerAuth(adminToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject deletion of fallback administrator"() {
        given:
        def adminToken = signupAdmin("adm-fbdel@example.com", "admfbdel")
        def fbAdmin = userRepository.findByEmail("adm-fbdel@example.com").get()
        fbAdmin.isFallbackAdministrator = true
        userRepository.update(fbAdmin)

        when:
        client.toBlocking().exchange(
                HttpRequest.DELETE("/administration/users/${fbAdmin.id}").bearerAuth(adminToken)
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject locking fallback administrator"() {
        given:
        def adminToken = signupAdmin("adm-fblock@example.com", "admfblock")
        def fbAdmin = userRepository.findByEmail("adm-fblock@example.com").get()
        fbAdmin.isFallbackAdministrator = true
        userRepository.update(fbAdmin)

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/administration/users/${fbAdmin.id}/lock", "").bearerAuth(adminToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    // =====================
    // SETUP COMPLETE
    // =====================

    def "should complete setup as fallback admin"() {
        given:
        signup("adm-setup@example.com", "admsetup")
        def user = userRepository.findByEmail("adm-setup@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        user.isFallbackAdministrator = true
        user.setupCompleted = false
        userRepository.update(user)
        def token = login("adm-setup@example.com")

        when:
        def response = client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "").bearerAuth(token),
                Map
        )

        then:
        response.status == HttpStatus.OK
        response.body().setupCompleted == true
    }

    def "should reject setup complete by regular user"() {
        given:
        def userToken = signup("adm-setupuser@example.com", "admsetupuser")

        when:
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "").bearerAuth(userToken),
                Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }

    def "should reject setup complete if already completed"() {
        given:
        signup("adm-setup2@example.com", "admsetup2")
        def user = userRepository.findByEmail("adm-setup2@example.com").get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        user.isFallbackAdministrator = true
        user.setupCompleted = false
        userRepository.update(user)
        def token = login("adm-setup2@example.com")

        // Complete setup first time
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "").bearerAuth(token), Map
        )

        when: "trying again"
        client.toBlocking().exchange(
                HttpRequest.POST("/setup/complete", "").bearerAuth(token), Map
        )

        then:
        def ex = thrown(HttpClientResponseException)
        ex.status == HttpStatus.FORBIDDEN
    }
}
