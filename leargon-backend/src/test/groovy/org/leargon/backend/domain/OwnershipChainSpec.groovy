package org.leargon.backend.domain

import spock.lang.Specification

/**
 * The effective-owner chain shared by the ownership display, the to-do routing and the creation policy:
 *  - domain:  owner → owning unit's business owner → parent domain (walked up the tree)
 *  - context: owner → owning team's business owner → domain
 *  - entity/process: explicit owner → owning unit's business owner → bounded context
 */
class OwnershipChainSpec extends Specification {

    private static User user(long id, String name) {
        new User(id: id, username: name, email: "${name}@test.com")
    }

    private static OrganisationalUnit unit(User owner, User steward = null) {
        new OrganisationalUnit(businessOwner: owner, businessSteward: steward)
    }

    def "a domain resolves its explicit owner before the owning unit and the parent"() {
        given:
        def alice = user(1, "alice")
        def unitOwner = user(2, "unitowner")
        def parentOwner = user(3, "parentowner")
        def parent = new BusinessDomain(owner: parentOwner)
        def domain = new BusinessDomain(owner: alice, owningUnit: unit(unitOwner), parent: parent)

        expect:
        domain.effectiveOwner() == alice
    }

    def "a domain without an explicit owner falls back to its owning unit, then to its parent domain"() {
        given:
        def unitOwner = user(2, "unitowner")
        def parentOwner = user(3, "parentowner")
        def parent = new BusinessDomain(owner: parentOwner)

        expect:
        new BusinessDomain(owningUnit: unit(unitOwner), parent: parent).effectiveOwner() == unitOwner
        new BusinessDomain(parent: parent).effectiveOwner() == parentOwner
        new BusinessDomain(parent: new BusinessDomain(parent: parent)).effectiveOwner() == parentOwner
        new BusinessDomain().effectiveOwner() == null
    }

    def "a domain steward is the owning unit's steward, inherited up the tree"() {
        given:
        def steward = user(4, "steward")
        def parent = new BusinessDomain(owningUnit: unit(null, steward))

        expect:
        new BusinessDomain(parent: parent).effectiveSteward() == steward
    }

    def "a cyclic domain hierarchy does not loop forever"() {
        given:
        def a = new BusinessDomain()
        def b = new BusinessDomain(parent: a)
        a.parent = b

        expect:
        a.effectiveOwner() == null
        a.realmOwners().isEmpty()
    }

    def "the domain realm contains the owner of every ancestor domain"() {
        given:
        def alice = user(1, "alice")
        def carol = user(5, "carol")
        def top = new BusinessDomain(owner: alice)
        def sub = new BusinessDomain(owner: carol, parent: top)

        expect:
        sub.realmOwners()*.username as Set == ["alice", "carol"] as Set
        top.realmOwners()*.username == ["alice"]
    }

    def "a bounded context resolves owner → owning team → domain"() {
        given:
        def bob = user(6, "bob")
        def teamLead = user(7, "teamlead")
        def domainOwner = user(1, "alice")
        def domain = new BusinessDomain(owner: domainOwner)

        expect:
        new BoundedContext(owner: bob, owningUnit: unit(teamLead), domain: domain).effectiveOwner() == bob
        new BoundedContext(owningUnit: unit(teamLead), domain: domain).effectiveOwner() == teamLead
        new BoundedContext(domain: domain).effectiveOwner() == domainOwner
    }

    def "the bounded-context realm contains its owner and the domain realm"() {
        given:
        def alice = user(1, "alice")
        def bob = user(6, "bob")
        def bc = new BoundedContext(owner: bob, domain: new BusinessDomain(owner: alice))

        expect:
        bc.realmOwners()*.username as Set == ["alice", "bob"] as Set
    }

    def "an entity resolves data owner → owning unit → bounded context"() {
        given:
        def dataOwner = user(8, "dataowner")
        def unitOwner = user(2, "unitowner")
        def bob = user(6, "bob")
        def bc = new BoundedContext(owner: bob, domain: new BusinessDomain())

        expect:
        new BusinessEntity(dataOwner: dataOwner, owningUnit: unit(unitOwner), boundedContext: bc).effectiveOwner() == dataOwner
        new BusinessEntity(owningUnit: unit(unitOwner), boundedContext: bc).effectiveOwner() == unitOwner
        new BusinessEntity(boundedContext: bc).effectiveOwner() == bob
        new BusinessEntity().effectiveOwner() == null
    }

    def "an entity's owning unit is inherited through its bounded context and the domain tree"() {
        given:
        def domainUnit = new OrganisationalUnit(key: "domain-unit")
        def parentDomain = new BusinessDomain(owningUnit: domainUnit)
        def bc = new BoundedContext(domain: new BusinessDomain(parent: parentDomain))

        expect:
        new BusinessEntity(boundedContext: bc).effectiveOwningUnit() == domainUnit
    }

    def "a process resolves process owner → owning unit → bounded context"() {
        given:
        def processOwner = user(9, "processowner")
        def bob = user(6, "bob")
        def bc = new BoundedContext(owner: bob, domain: new BusinessDomain())

        expect:
        new Process(processOwner: processOwner, boundedContext: bc).effectiveOwner() == processOwner
        new Process(boundedContext: bc).effectiveOwner() == bob
    }

    def "a capability inherits its owning unit's owner down the capability tree"() {
        given:
        def unitOwner = user(2, "unitowner")
        def l1 = new Capability(owningUnit: unit(unitOwner))
        def l2 = new Capability(parent: l1)

        expect:
        l2.effectiveOwner() == unitOwner
        new Capability().effectiveOwner() == null
    }
}
