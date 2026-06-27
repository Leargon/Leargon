package org.leargon.backend.service

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.User
import spock.lang.Specification

/**
 * Layer 2 — role parsing. Verifies the composite role tokens in {@code User.roles} are interpreted into
 * the scope model: global admin, methodology-scoped editors, methodology-scoped leads (lead ⇒ editor).
 */
@MicronautTest(transactional = false)
class RoleServiceSpec extends Specification {

    @Inject
    RoleService roleService

    private static User userWith(String roles) {
        new User(roles: roles)
    }

    def "parses admin and scoped editor/lead tokens, lead implies editor for the same methodology"() {
        when:
        def scopes = roleService.scopesOf(userWith("ROLE_USER,ROLE_LEAD_GDPR,ROLE_EDITOR_DDD"))

        then:
        !scopes.isAdmin
        scopes.leadMethodologies == ["GDPR"] as Set
        // lead GDPR implies editor GDPR, plus the explicit editor DDD
        scopes.editorMethodologies == ["GDPR", "DDD"] as Set
    }

    def "admin token is recognised"() {
        expect:
        roleService.scopesOf(userWith("ROLE_USER,ROLE_ADMIN")).isAdmin
    }

    def "unknown methodology tokens are ignored"() {
        when:
        def scopes = roleService.scopesOf(userWith("ROLE_EDITOR_NONSENSE,ROLE_LEAD_ALSO_FAKE"))

        then:
        scopes.editorMethodologies.isEmpty()
        scopes.leadMethodologies.isEmpty()
    }

    def "isEditorFor / isLeadFor honour the lead-implies-editor rule"() {
        given:
        def lead = userWith("ROLE_LEAD_GDPR")

        expect:
        roleService.isLeadFor(lead, "GDPR")
        roleService.isEditorFor(lead, "GDPR")
        !roleService.isLeadFor(lead, "DDD")
    }

    def "admin is editor and lead for every methodology"() {
        given:
        def admin = userWith("ROLE_ADMIN")

        expect:
        roleService.isEditorFor(admin, "DDD")
        roleService.isLeadFor(admin, "BCM")
    }

    def "isValidRoleToken accepts globals and known scoped tokens, rejects junk"() {
        expect:
        roleService.isValidRoleToken("ROLE_USER")
        roleService.isValidRoleToken("ROLE_ADMIN")
        roleService.isValidRoleToken("ROLE_LEAD_GDPR")
        roleService.isValidRoleToken("ROLE_EDITOR_DDD")
        !roleService.isValidRoleToken("ROLE_LEAD_NONSENSE")
        !roleService.isValidRoleToken("ROLE_SUPERHERO")
    }

    def "canEditFieldByRole gates by the field's methodology"() {
        given: "an editor scoped to GDPR"
        def editor = userWith("ROLE_EDITOR_GDPR")

        expect: "may edit a GDPR-section process field"
        roleService.canEditFieldByRole(editor, "BUSINESS_PROCESS", "legalBasis")

        and: "may not edit a CORE/non-GDPR process field"
        !roleService.canEditFieldByRole(editor, "BUSINESS_PROCESS", "processType")
    }
}
