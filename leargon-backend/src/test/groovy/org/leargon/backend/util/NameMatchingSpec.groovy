package org.leargon.backend.util

import spock.lang.Specification

class NameMatchingSpec extends Specification {

    private static final NameMatching M = NameMatching.INSTANCE

    def "normalisation strips diacritics, folds ß and replaces punctuation"() {
        expect:
        M.normalize("Müller-Daten") == "muller daten"
        M.normalize("  Straße ") == "strasse"
        M.normalize("Order_Line (v2)") == "order line v2"
    }

    def "spelling variants of the same name are exact matches after normalisation"() {
        expect:
        M.match("Straße", "Strasse").type == NameMatching.MatchType.EXACT
        M.match("Customer", "customer").type == NameMatching.MatchType.EXACT
    }

    def "near spellings and reordered words are similar"() {
        expect:
        M.match("Müller-Daten", "Mueller Daten").type == NameMatching.MatchType.SIMILAR
        M.match("Customer Order", "Order Customer").type == NameMatching.MatchType.SIMILAR
    }

    def "names written with and without spaces are the same name"() {
        expect:
        M.match("CustomerOrder", "Customer Order").type == NameMatching.MatchType.EXACT
    }

    def "a replaced word makes a different name, not a typo"() {
        expect:
        M.match("Plant A", "Plant B") == null
        M.match("Domain A", "Domain B") == null
        M.match("Team North", "Team South") == null
        M.match("Customer", "Customers").type == NameMatching.MatchType.SIMILAR
    }

    def "camel-case names are split into words before comparing"() {
        expect:
        M.normalize("RiskManagementContext") == "risk management context"
        M.normalize("HRSystem") == "hr system"
        M.match("PolicyManagementContext", "RiskManagementContext") == null
        M.match("CustomerSelfServiceContextSubdomain", "CustomerManagementContextSubdomain") == null
        M.match("CountedEntityOne", "CountedEntityTwo") == null
        M.match("CustomerOrder", "customer order").type == NameMatching.MatchType.EXACT
    }

    def "numbers are significant"() {
        expect:
        M.match("Invoice 2023", "Invoice 2024") == null
        M.match("PW Entity 1726312345678", "PW Entity 1726312345999") == null
    }

    def "unrelated names do not match"() {
        expect:
        M.match("Customer", "Supplier") == null
        M.match("", "Customer") == null
    }

    def "the best match compares every locale against every locale"() {
        when:
        def match = M.bestMatch(["Kunde"], ["Customer", "Kunde"])

        then:
        match.type == NameMatching.MatchType.EXACT
        match.score == 1.0d
    }
}
