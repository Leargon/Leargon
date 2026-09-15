package org.leargon.backend.util

import spock.lang.Specification

class KeyAllocatorSpec extends Specification {

    def "returns the base key when it is free"() {
        expect:
        KeyAllocator.INSTANCE.allocate("sales.order") { false } == "sales.order"
    }

    def "appends the first free numeric suffix when the base key is taken"() {
        given:
        def taken = ["sales.order", "sales.order-2"] as Set

        expect:
        KeyAllocator.INSTANCE.allocate("sales.order") { taken.contains(it) } == "sales.order-3"
    }

    def "starts suffixing at 2"() {
        expect:
        KeyAllocator.INSTANCE.allocate("onboarding") { it == "onboarding" } == "onboarding-2"
    }
}
