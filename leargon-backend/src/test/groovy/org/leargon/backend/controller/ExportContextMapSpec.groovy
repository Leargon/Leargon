package org.leargon.backend.controller

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.HttpClient
import io.micronaut.http.client.annotation.Client
import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.SupportedLocale
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.repository.BoundedContextRepository
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessDomainVersionRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.BusinessEntityVersionRepository
import org.leargon.backend.repository.ContextRelationshipRepository
import org.leargon.backend.repository.SupportedLocaleRepository
import org.leargon.backend.repository.UserRepository
import spock.lang.Specification

/**
 * Verifies the CML export against the Context Mapper insurance example structure.
 *
 * Reference: https://github.com/ContextMapper/context-mapper-examples/blob/master/src/main/cml/insurance-example/Insurance-Example-Stage-5.cml
 *
 * Fields not supported by Léargon (implementationTechnology, exposedAggregates,
 * downstreamRights, entity attributes, ValueObjects, team BoundedContexts) are
 * intentionally omitted — this test covers the structural elements that Léargon can model.
 */
@MicronautTest(transactional = false)
class ExportContextMapSpec extends Specification {

    @Inject @Client("/") HttpClient client

    @Inject UserRepository userRepository
    @Inject SupportedLocaleRepository localeRepository
    @Inject ContextRelationshipRepository contextRelationshipRepository
    @Inject BoundedContextRepository boundedContextRepository
    @Inject BusinessDomainVersionRepository businessDomainVersionRepository
    @Inject BusinessDomainRepository businessDomainRepository
    @Inject BusinessEntityVersionRepository businessEntityVersionRepository
    @Inject BusinessEntityRepository businessEntityRepository

    def setup() {
        if (localeRepository.count() == 0) {
            localeRepository.save(new SupportedLocale(
                localeCode: "en", displayName: "English", isDefault: true, isActive: true, sortOrder: 1))
        }
    }

    def cleanup() {
        contextRelationshipRepository.deleteAll()
        businessEntityRepository.findAll().each { businessEntityRepository.delete(it) }
        businessEntityVersionRepository.deleteAll()
        boundedContextRepository.deleteAll()
        businessDomainVersionRepository.deleteAll()
        // Delete children before parents to avoid FK violations
        def domains = businessDomainRepository.findAll()
        domains.findAll { it.parent != null }.each { businessDomainRepository.delete(it) }
        domains.findAll { it.parent == null }.each { businessDomainRepository.delete(it) }
        userRepository.deleteAll()
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private String createAdminToken() {
        def email = "admin-cml-${System.currentTimeMillis()}@test.com"
        def username = "adminCml${System.currentTimeMillis()}"
        client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest(email, username, "password123", "Admin", "User")))
        def user = userRepository.findByEmail(email).get()
        user.roles = "ROLE_USER,ROLE_ADMIN"
        userRepository.update(user)
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/login",
                new LoginRequest(email, "password123")), Map)
        resp.body().accessToken
    }

    private String createDomain(String adminToken, String name, String domainType = null, String parentKey = null) {
        def body = [names: [[locale: "en", text: name]]]
        if (domainType) body.type = domainType
        if (parentKey) body.parentKey = parentKey
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private String createBoundedContext(String adminToken, String domainKey, String name,
                                        String contextType = null, String description = null) {
        def body = [names: [[locale: "en", text: name]]]
        if (contextType) body.contextType = contextType
        if (description) body.descriptions = [[locale: "en", text: description]]
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-domains/${domainKey}/bounded-contexts", body).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private void createRelationship(String adminToken, String upKey, String downKey, String type) {
        client.toBlocking().exchange(
            HttpRequest.POST("/context-relationships", [
                upstreamBoundedContextKey  : upKey,
                downstreamBoundedContextKey: downKey,
                relationshipType           : type
            ]).bearerAuth(adminToken), Map)
    }

    private String createEntity(String adminToken, String name) {
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/business-entities", [names: [[locale: "en", text: name]]]).bearerAuth(adminToken), Map)
        resp.body().key
    }

    private void assignEntityToBoundedContext(String adminToken, String entityKey, String bcKey) {
        client.toBlocking().exchange(
            HttpRequest.PUT("/business-entities/${entityKey}/bounded-context",
                [boundedContextKey: bcKey]).bearerAuth(adminToken))
    }

    // ─── main test ───────────────────────────────────────────────────────────

    def "GET /export/context-map produces valid CML for insurance-example structure"() {
        given: "an admin user"
        def adminToken = createAdminToken()

        and: "a single Insurance domain (all BCs live here as subdomains)"
        def domainKey = createDomain(adminToken, "Insurance Domain")

        and: "six bounded contexts matching the insurance example"
        // CustomerManagementContext has no special type in the example
        def cmcKey = createBoundedContext(adminToken, domainKey, "CustomerManagementContext")

        // CustomerSelfServiceContext is an APPLICATION
        def csscKey = createBoundedContext(adminToken, domainKey, "CustomerSelfServiceContext",
            "APPLICATION",
            "This context represents a web application which allows the customer to login and change basic data records like the address.")

        // PrintingContext is an external SYSTEM
        def printingKey = createBoundedContext(adminToken, domainKey, "PrintingContext",
            "SYSTEM",
            "An external system which provides printing services to the other Bounded Contexts.")

        // PolicyManagementContext is a FEATURE
        def pmcKey = createBoundedContext(adminToken, domainKey, "PolicyManagementContext",
            "FEATURE",
            "This bounded context manages the contracts and policies of the customers.")

        // RiskManagementContext is a FEATURE
        def rmcKey = createBoundedContext(adminToken, domainKey, "RiskManagementContext",
            "FEATURE",
            "Uses data from PolicyManagement context to calculate risks.")

        // DebtCollection is a FEATURE
        def debtBcKey = createBoundedContext(adminToken, domainKey, "DebtCollection",
            "FEATURE",
            "The debt collection context is responsible for the financial income of the insurance company.")

        and: "seven context relationships from the insurance example"
        // CustomerSelfServiceContext [D,C] <- [U,S] CustomerManagementContext
        createRelationship(adminToken, cmcKey, csscKey, "CUSTOMER_SUPPLIER")
        // CustomerManagementContext [D,ACL] <- [U,OHS,PL] PrintingContext  (Léargon: ANTICORRUPTION_LAYER)
        createRelationship(adminToken, printingKey, cmcKey, "ANTICORRUPTION_LAYER")
        // PrintingContext [U,OHS,PL] -> [D,ACL] PolicyManagementContext
        createRelationship(adminToken, printingKey, pmcKey, "ANTICORRUPTION_LAYER")
        // RiskManagementContext [P] <-> [P] PolicyManagementContext
        createRelationship(adminToken, pmcKey, rmcKey, "PARTNERSHIP")
        // PolicyManagementContext [D,CF] <- [U,OHS,PL] CustomerManagementContext  (Léargon: CONFORMIST)
        createRelationship(adminToken, cmcKey, pmcKey, "CONFORMIST")
        // DebtCollection [D,ACL] <- [U,OHS,PL] PrintingContext
        createRelationship(adminToken, printingKey, debtBcKey, "ANTICORRUPTION_LAYER")
        // PolicyManagementContext [SK] <-> [SK] DebtCollection
        createRelationship(adminToken, pmcKey, debtBcKey, "SHARED_KERNEL")

        and: "entities assigned to their bounded contexts"
        def customerKey = createEntity(adminToken, "Customer")
        def addressKey  = createEntity(adminToken, "Address")
        assignEntityToBoundedContext(adminToken, customerKey, cmcKey)
        assignEntityToBoundedContext(adminToken, addressKey, cmcKey)

        def printingJobKey = createEntity(adminToken, "PrintingJob")
        assignEntityToBoundedContext(adminToken, printingJobKey, printingKey)

        def offerKey    = createEntity(adminToken, "Offer")
        def productKey  = createEntity(adminToken, "Product")
        def contractKey = createEntity(adminToken, "Contract")
        assignEntityToBoundedContext(adminToken, offerKey,    pmcKey)
        assignEntityToBoundedContext(adminToken, productKey,  pmcKey)
        assignEntityToBoundedContext(adminToken, contractKey, pmcKey)

        def riskFactorKey = createEntity(adminToken, "CustomerRiskFactor")
        assignEntityToBoundedContext(adminToken, riskFactorKey, rmcKey)

        def debtEntityKey = createEntity(adminToken, "Debt")
        assignEntityToBoundedContext(adminToken, debtEntityKey, debtBcKey)

        when: "admin exports the context map"
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/context-map").bearerAuth(adminToken), String)

        then: "HTTP 200 with CML content"
        response.status == HttpStatus.OK
        def cml = response.body()
        cml != null && !cml.isBlank()

        and: "ContextMap block declares all six bounded contexts"
        cml.contains("ContextMap LeargonContextMap {")
        cml.contains("CustomerManagementContext")
        cml.contains("CustomerSelfServiceContext")
        cml.contains("PrintingContext")
        cml.contains("PolicyManagementContext")
        cml.contains("RiskManagementContext")
        cml.contains("DebtCollection")

        and: "relationships use correct CML pattern notation"
        // Customer-Supplier
        cml.contains("CustomerManagementContext [U,S] -> [D,C] CustomerSelfServiceContext")
        // Anti-Corruption Layer (upstream has no OHS in Léargon's ANTICORRUPTION_LAYER type)
        cml.contains("PrintingContext [U] -> [D,ACL] CustomerManagementContext")
        cml.contains("PrintingContext [U] -> [D,ACL] PolicyManagementContext")
        cml.contains("PrintingContext [U] -> [D,ACL] DebtCollection")
        // Partnership (symmetric keyword)
        cml.contains("PolicyManagementContext Partnership RiskManagementContext")
        // Conformist
        cml.contains("CustomerManagementContext [U] -> [D,CF] PolicyManagementContext")
        // Shared Kernel
        cml.contains("PolicyManagementContext [SK] <-> [SK] DebtCollection")

        and: "Domain block exists with all six subdomains"
        cml.contains("Domain Insurance_Domain {")
        cml.contains("Subdomain CustomerManagementContextSubdomain {")
        cml.contains("Subdomain CustomerSelfServiceContextSubdomain {")
        cml.contains("Subdomain PrintingContextSubdomain {")
        cml.contains("Subdomain PolicyManagementContextSubdomain {")
        cml.contains("Subdomain RiskManagementContextSubdomain {")
        cml.contains("Subdomain DebtCollectionSubdomain {")

        and: "subdomain vision statements come from BC descriptions"
        cml.contains("This context represents a web application which allows the customer to login and change basic data records like the address.")
        cml.contains("An external system which provides printing services to the other Bounded Contexts.")
        cml.contains("This bounded context manages the contracts and policies of the customers.")
        cml.contains("Uses data from PolicyManagement context to calculate risks.")
        cml.contains("The debt collection context is responsible for the financial income of the insurance company.")

        and: "entities appear in their subdomains (problem space)"
        cml.contains("Entity Customer { }")
        cml.contains("Entity Address { }")
        cml.contains("Entity PrintingJob { }")
        cml.contains("Entity Offer { }")
        cml.contains("Entity Product { }")
        cml.contains("Entity Contract { }")
        cml.contains("Entity CustomerRiskFactor { }")
        cml.contains("Entity Debt { }")

        and: "BoundedContext blocks implement their subdomains"
        cml.contains("BoundedContext CustomerManagementContext implements CustomerManagementContextSubdomain {")
        cml.contains("BoundedContext CustomerSelfServiceContext implements CustomerSelfServiceContextSubdomain {")
        cml.contains("BoundedContext PrintingContext implements PrintingContextSubdomain {")
        cml.contains("BoundedContext PolicyManagementContext implements PolicyManagementContextSubdomain {")
        cml.contains("BoundedContext RiskManagementContext implements RiskManagementContextSubdomain {")
        cml.contains("BoundedContext DebtCollection implements DebtCollectionSubdomain {")

        and: "BoundedContext types are exported correctly"
        cml.contains("type = APPLICATION")  // CustomerSelfServiceContext
        cml.contains("type = SYSTEM")        // PrintingContext
        cml.contains("type = FEATURE")       // PolicyManagement, RiskManagement, DebtCollection

        and: "Aggregates with aggregateRoot entities appear in BoundedContexts (solution space)"
        cml.contains("Aggregate CustomerAggregate {")
        cml.contains("Aggregate AddressAggregate {")
        cml.contains("Aggregate PrintingJobAggregate {")
        cml.contains("Aggregate OfferAggregate {")
        cml.contains("Aggregate ProductAggregate {")
        cml.contains("Aggregate ContractAggregate {")
        cml.contains("Aggregate CustomerRiskFactorAggregate {")
        cml.contains("Aggregate DebtAggregate {")
        cml.contains("aggregateRoot")
    }

    def "GET /export/context-map output exactly matches predefined CML"() {
        given: "root domain Insurance_Domain (BUSINESS) with six typed child subdomain domains"
        def adminToken       = createAdminToken()
        def insuranceDomainKey = createDomain(adminToken, "Insurance Domain", "BUSINESS")

        // Child domains — names become CML subdomain identifiers; types drive subdomain type lines
        def cmcDomainKey  = createDomain(adminToken, "CustomerManagementContextSubdomain",  "CORE",    insuranceDomainKey)
        def csscDomainKey = createDomain(adminToken, "CustomerSelfServiceContextSubdomain", "CORE",    insuranceDomainKey)
        def pmcDomainKey  = createDomain(adminToken, "PolicyManagementContextSubdomain",    "SUPPORT", insuranceDomainKey)
        def printDomainKey = createDomain(adminToken, "PrintingContextSubdomain",           "GENERIC", insuranceDomainKey)
        def rmcDomainKey  = createDomain(adminToken, "RiskManagementContextSubdomain",      "GENERIC", insuranceDomainKey)
        def debtDomainKey = createDomain(adminToken, "DebtCollectionSubdomain",             "GENERIC", insuranceDomainKey)

        and: "six bounded contexts — each assigned to its child domain, no contextType"
        // Creation order determines the `contains` line order in the exported CML
        def cmcKey      = createBoundedContext(adminToken, cmcDomainKey,   "CustomerManagementContext",
            null, null)
        def csscKey     = createBoundedContext(adminToken, csscDomainKey,  "CustomerSelfServiceContext",
            null, "This context represents a web application which allows the customer to login and change basic data records like the address.")
        def printingKey = createBoundedContext(adminToken, printDomainKey, "PrintingContext",
            null, "An external system which provides printing services to the other Bounded Contexts.")
        def pmcKey      = createBoundedContext(adminToken, pmcDomainKey,   "PolicyManagementContext",
            null, "This bounded context manages the contracts and policies of the customers.")
        def rmcKey      = createBoundedContext(adminToken, rmcDomainKey,   "RiskManagementContext",
            null, "Uses data from PolicyManagement context to calculate risks.")
        def debtBcKey   = createBoundedContext(adminToken, debtDomainKey,  "DebtCollection",
            null, "The debt collection context is responsible for the financial income of the insurance company.")

        and: "seven relationships from the insurance example"
        createRelationship(adminToken, cmcKey,      csscKey,   "CUSTOMER_SUPPLIER")
        createRelationship(adminToken, printingKey, cmcKey,    "ANTICORRUPTION_LAYER")
        createRelationship(adminToken, printingKey, pmcKey,    "ANTICORRUPTION_LAYER")
        createRelationship(adminToken, pmcKey,      rmcKey,    "PARTNERSHIP")
        createRelationship(adminToken, cmcKey,      pmcKey,    "CONFORMIST")
        createRelationship(adminToken, printingKey, debtBcKey, "ANTICORRUPTION_LAYER")
        createRelationship(adminToken, pmcKey,      debtBcKey, "SHARED_KERNEL")

        and: "entities assigned to their bounded contexts"
        def customerKey    = createEntity(adminToken, "Customer")
        def addressKey     = createEntity(adminToken, "Address")
        assignEntityToBoundedContext(adminToken, customerKey, cmcKey)
        assignEntityToBoundedContext(adminToken, addressKey,  cmcKey)

        def printingJobKey = createEntity(adminToken, "PrintingJob")
        assignEntityToBoundedContext(adminToken, printingJobKey, printingKey)

        def offerKey    = createEntity(adminToken, "Offer")
        def productKey  = createEntity(adminToken, "Product")
        def contractKey = createEntity(adminToken, "Contract")
        assignEntityToBoundedContext(adminToken, offerKey,    pmcKey)
        assignEntityToBoundedContext(adminToken, productKey,  pmcKey)
        assignEntityToBoundedContext(adminToken, contractKey, pmcKey)

        def riskFactorKey = createEntity(adminToken, "CustomerRiskFactor")
        assignEntityToBoundedContext(adminToken, riskFactorKey, rmcKey)

        def debtEntityKey = createEntity(adminToken, "Debt")
        assignEntityToBoundedContext(adminToken, debtEntityKey, debtBcKey)

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/context-map").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        def expected = getClass().getResourceAsStream("/expected-insurance-context-map.cml")
            .getText("UTF-8")
        normaliseCml(response.body()) == normaliseCml(expected)
    }

    private static String normaliseCml(String text) {
        // normalise line endings and trim surrounding whitespace so the
        // comparison is insensitive to trailing newlines and CRLF differences
        text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim()
    }

    def "GET /export/context-map returns 401 without authentication"() {
        when:
        client.toBlocking().exchange(HttpRequest.GET("/export/context-map"), String)

        then:
        def e = thrown(io.micronaut.http.client.exceptions.HttpClientResponseException)
        e.status == HttpStatus.UNAUTHORIZED
    }

    def "GET /export/context-map returns 403 for non-admin"() {
        given:
        def resp = client.toBlocking().exchange(
            HttpRequest.POST("/authentication/signup",
                new SignupRequest("user-cml@test.com", "userCml", "password123", "Test", "User")), Map)
        def userToken = resp.body().accessToken

        when:
        client.toBlocking().exchange(HttpRequest.GET("/export/context-map").bearerAuth(userToken), String)

        then:
        def e = thrown(io.micronaut.http.client.exceptions.HttpClientResponseException)
        e.status == HttpStatus.FORBIDDEN
    }

    def "GET /export/context-map returns empty ContextMap when no data exists"() {
        given:
        def adminToken = createAdminToken()

        when:
        def response = client.toBlocking().exchange(
            HttpRequest.GET("/export/context-map").bearerAuth(adminToken), String)

        then:
        response.status == HttpStatus.OK
        response.body().contains("ContextMap LeargonContextMap {")
        !response.body().contains("BoundedContext ")
        !response.body().contains("Domain ")
    }
}
