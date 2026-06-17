package org.leargon.backend.domain

import spock.lang.Specification

class LocalizedTextSpec extends Specification {

    def "should trim trailing spaces from text"() {
        when:
        def lt = new LocalizedText("en", "Customer   ")

        then:
        lt.text == "Customer"

        when:
        lt.text = "   User  "

        then:
        lt.text == "   User"
    }

    def "should not trim leading spaces from text"() {
        when:
        def lt = new LocalizedText("en", "  Customer")

        then:
        lt.text == "  Customer"
    }

    def "should handle null or empty text gracefully"() {
        when:
        def lt = new LocalizedText("en", "")

        then:
        lt.text == ""
    }
}
