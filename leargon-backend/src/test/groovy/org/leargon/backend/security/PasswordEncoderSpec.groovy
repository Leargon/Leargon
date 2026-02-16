package org.leargon.backend.security

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import spock.lang.Specification

@MicronautTest
class PasswordEncoderSpec extends Specification {

    @Inject
    PasswordEncoder passwordEncoder

    def "should encode password successfully"() {
        given: "a raw password"
        def rawPassword = "password123"

        when: "encoding the password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "encoded password is not null"
        encodedPassword != null

        and: "encoded password is different from raw password"
        encodedPassword != rawPassword

        and: "encoded password starts with BCrypt identifier"
        encodedPassword.startsWith('$2')
    }

    def "should encode same password to different hashes"() {
        given: "the same raw password"
        def rawPassword = "samepassword"

        when: "encoding the password multiple times"
        def hash1 = passwordEncoder.encode(rawPassword)
        def hash2 = passwordEncoder.encode(rawPassword)
        def hash3 = passwordEncoder.encode(rawPassword)

        then: "each hash is different due to random salt"
        hash1 != hash2
        hash2 != hash3
        hash1 != hash3

        and: "all hashes verify correctly"
        passwordEncoder.matches(rawPassword, hash1)
        passwordEncoder.matches(rawPassword, hash2)
        passwordEncoder.matches(rawPassword, hash3)
    }

    def "should match correct password"() {
        given: "a password and its hash"
        def rawPassword = "correctpassword"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        when: "checking if password matches"
        def matches = passwordEncoder.matches(rawPassword, encodedPassword)

        then: "password matches"
        matches
    }

    def "should not match incorrect password"() {
        given: "a password and its hash"
        def rawPassword = "correctpassword"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        when: "checking if wrong password matches"
        def matches = passwordEncoder.matches("wrongpassword", encodedPassword)

        then: "password does not match"
        !matches
    }

    def "should not match password with different case"() {
        given: "a password and its hash"
        def rawPassword = "Password123"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        when: "checking if password with different case matches"
        def matches = passwordEncoder.matches("password123", encodedPassword)

        then: "password does not match"
        !matches
    }

    def "should handle empty password"() {
        given: "an empty password"
        def rawPassword = ""

        when: "encoding the empty password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "encoding succeeds"
        encodedPassword != null
        encodedPassword != ""

        and: "empty password matches"
        passwordEncoder.matches("", encodedPassword)

        and: "non-empty password does not match"
        !passwordEncoder.matches("anything", encodedPassword)
    }

    def "should handle special characters in password"() {
        given: "a password with special characters"
        def rawPassword = "p@ssw0rd!#\$%^&*()"

        when: "encoding the password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "encoding succeeds"
        encodedPassword != null

        and: "password matches correctly"
        passwordEncoder.matches("p@ssw0rd!#\$%^&*()", encodedPassword)

        and: "similar password does not match"
        !passwordEncoder.matches("p@ssw0rd!", encodedPassword)
    }

    def "should handle long password"() {
        given: "a long password (within BCrypt 72-byte limit)"
        def rawPassword = "a" * 70

        when: "encoding the password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "encoding succeeds"
        encodedPassword != null

        and: "password matches correctly"
        passwordEncoder.matches(rawPassword, encodedPassword)

        and: "shorter password does not match"
        !passwordEncoder.matches("a" * 69, encodedPassword)
    }

    def "should handle unicode characters in password"() {
        given: "a password with unicode characters"
        def rawPassword = "pässwörd123€"

        when: "encoding the password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "encoding succeeds"
        encodedPassword != null

        and: "password matches correctly"
        passwordEncoder.matches("pässwörd123€", encodedPassword)
    }

    def "should verify multiple passwords independently"() {
        given: "multiple passwords and their hashes"
        def password1 = "password1"
        def password2 = "password2"
        def password3 = "password3"

        def hash1 = passwordEncoder.encode(password1)
        def hash2 = passwordEncoder.encode(password2)
        def hash3 = passwordEncoder.encode(password3)

        expect: "each password matches only its own hash"
        passwordEncoder.matches(password1, hash1)
        passwordEncoder.matches(password2, hash2)
        passwordEncoder.matches(password3, hash3)

        !passwordEncoder.matches(password1, hash2)
        !passwordEncoder.matches(password1, hash3)
        !passwordEncoder.matches(password2, hash1)
        !passwordEncoder.matches(password2, hash3)
        !passwordEncoder.matches(password3, hash1)
        !passwordEncoder.matches(password3, hash2)
    }

    def "should handle whitespace in password"() {
        given: "passwords with whitespace"
        def passwordWithSpaces = "pass word 123"
        def passwordWithTabs = "pass\tword\t123"
        def passwordWithNewlines = "pass\nword\n123"

        when: "encoding passwords"
        def hash1 = passwordEncoder.encode(passwordWithSpaces)
        def hash2 = passwordEncoder.encode(passwordWithTabs)
        def hash3 = passwordEncoder.encode(passwordWithNewlines)

        then: "all encode successfully"
        hash1 != null
        hash2 != null
        hash3 != null

        and: "each matches its original"
        passwordEncoder.matches(passwordWithSpaces, hash1)
        passwordEncoder.matches(passwordWithTabs, hash2)
        passwordEncoder.matches(passwordWithNewlines, hash3)

        and: "different whitespace does not match"
        !passwordEncoder.matches(passwordWithSpaces, hash2)
        !passwordEncoder.matches(passwordWithTabs, hash3)
    }

    def "should produce BCrypt hash with correct strength"() {
        given: "a raw password"
        def rawPassword = "testpassword"

        when: "encoding the password"
        def encodedPassword = passwordEncoder.encode(rawPassword)

        then: "hash has BCrypt format"
        encodedPassword ==~ /\$2[aby]\$\d{2}\$.{53}/

        and: "hash indicates strength 12 (configured BCrypt strength)"
        encodedPassword.substring(0, 7) == '$2a$12\$' || encodedPassword.substring(0, 7) == '$2b$12\$' || encodedPassword.substring(0, 7) == '$2y$12\$'
    }
}
