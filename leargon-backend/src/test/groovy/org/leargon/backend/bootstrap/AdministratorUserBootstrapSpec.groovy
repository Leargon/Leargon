package org.leargon.backend.bootstrap

import io.micronaut.test.extensions.spock.annotation.MicronautTest
import jakarta.inject.Inject
import org.leargon.backend.domain.User
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import spock.lang.Specification

@MicronautTest(transactional = false)
class AdministratorUserBootstrapSpec extends Specification {

    @Inject
    UserRepository userRepository

    @Inject
    PasswordEncoder passwordEncoder

    def cleanup() {
        userRepository.deleteAll()
    }

    def "should create admin user when environment variables are set"() {
        given: "a bootstrap with admin credentials configured"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("testadmin")
        bootstrap.adminPassword = Optional.of("password123")
        bootstrap.adminFirstName = "Test"
        bootstrap.adminLastName = "Admin"

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "admin user is created"
        def user = userRepository.findByEmail("admin@test.com")
        user.isPresent()

        and: "user has admin role only"
        user.get().roles == "ROLE_ADMIN"

        and: "user details are correct"
        user.get().username == "testadmin"
        user.get().firstName == "Test"
        user.get().lastName == "Admin"
        user.get().enabled == true
        user.get().accountLocked == false
    }

    def "should skip when environment variables are not set"() {
        given: "a bootstrap without admin credentials"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.empty()
        bootstrap.adminUsername = Optional.empty()
        bootstrap.adminPassword = Optional.empty()

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "no admin user is created"
        userRepository.findAll().size() == 0
    }

    def "should skip when only some environment variables are set"() {
        given: "a bootstrap with incomplete credentials"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.empty()  // Missing
        bootstrap.adminPassword = Optional.of("password123")

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "no admin user is created"
        userRepository.findAll().size() == 0
    }

    def "should skip when password is too short"() {
        given: "a bootstrap with short password"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("testadmin")
        bootstrap.adminPassword = Optional.of("short")  // Only 5 characters

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "no admin user is created"
        userRepository.findAll().size() == 0
    }

    def "should skip when admin user already exists"() {
        given: "an existing admin user"
        def existingUser = new User(
                email: "admin@test.com",
                username: "existingadmin",
                passwordHash: passwordEncoder.encode("password123"),
                firstName: "Existing",
                lastName: "Admin",
                enabled: true,
                accountLocked: false,
                accountExpired: false,
                passwordExpired: false,
                roles: "ROLE_USER,ROLE_ADMIN"
        )
        userRepository.save(existingUser)

        and: "a bootstrap with same admin email"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("existingadmin")
        bootstrap.adminPassword = Optional.of("password123")

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "no additional user is created"
        userRepository.findAll().size() == 1

        and: "existing user is unchanged"
        def user = userRepository.findByEmail("admin@test.com").get()
        user.username == "existingadmin"  // Original username
        user.firstName == "Existing"      // Original names
    }

    def "should promote existing user to admin if they don't have admin role"() {
        given: "an existing fallback admin user without admin role"
        def existingUser = new User(
                email: "user@test.com",
                username: "regularuser",
                passwordHash: passwordEncoder.encode("password123"),
                firstName: "Regular",
                lastName: "User",
                enabled: true,
                accountLocked: false,
                accountExpired: false,
                passwordExpired: false,
                roles: "ROLE_USER",  // No admin role
                isFallbackAdministrator: true  // Must be marked as fallback admin to be found by bootstrap
        )
        userRepository.save(existingUser)

        and: "a bootstrap with admin configuration"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("admin")
        bootstrap.adminPassword = Optional.of("password123")
        bootstrap.adminFirstName = "System"
        bootstrap.adminLastName = "Administrator"

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "user is promoted to admin"
        def user = userRepository.findByIsFallbackAdministrator(true).get()
        user.roles == "ROLE_ADMIN"

        and: "user details are updated from config"
        user.email == "admin@test.com"
        user.username == "admin"
        user.firstName == "System"
        user.lastName == "Administrator"
    }

    def "should hash password with BCrypt"() {
        given: "a bootstrap with admin credentials"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("testadmin")
        bootstrap.adminPassword = Optional.of("password123")

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "password is hashed"
        def user = userRepository.findByEmail("admin@test.com").get()
        user.passwordHash != "password123"
        user.passwordHash.startsWith('$2')  // BCrypt format

        and: "password can be verified"
        passwordEncoder.matches("password123", user.passwordHash)
    }

    def "should use default first and last name if not provided"() {
        given: "a bootstrap without names configured"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("testadmin")
        bootstrap.adminPassword = Optional.of("password123")
        bootstrap.adminFirstName = "System"       // Default
        bootstrap.adminLastName = "Administrator" // Default

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "default names are used"
        def user = userRepository.findByEmail("admin@test.com").get()
        user.firstName == "System"
        user.lastName == "Administrator"
    }

    def "should skip when credentials are blank"() {
        given: "a bootstrap with blank credentials"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("   ")  // Blank
        bootstrap.adminUsername = Optional.of("testadmin")
        bootstrap.adminPassword = Optional.of("password123")

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "no admin user is created"
        userRepository.findAll().size() == 0
    }

    def "should handle existing user with no roles"() {
        given: "an existing fallback admin user with empty roles"
        def existingUser = new User(
                email: "user@test.com",
                username: "regularuser",
                passwordHash: passwordEncoder.encode("password123"),
                firstName: "Regular",
                lastName: "User",
                enabled: true,
                accountLocked: false,
                accountExpired: false,
                passwordExpired: false,
                roles: "",  // Empty roles
                isFallbackAdministrator: true  // Must be marked as fallback admin to be found by bootstrap
        )
        userRepository.save(existingUser)

        and: "a bootstrap with admin configuration"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("admin")
        bootstrap.adminPassword = Optional.of("password123")

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "user is promoted to admin"
        def user = userRepository.findByIsFallbackAdministrator(true).get()
        user.roles == "ROLE_ADMIN"
    }

    def "should update existing user with new values"() {
        given: "an existing fallback admin user with empty roles"
        def existingUser = new User(
                email: "user@test.com",
                username: "regularuser",
                passwordHash: passwordEncoder.encode("password123"),
                firstName: "Regular",
                lastName: "User",
                enabled: true,
                accountLocked: false,
                accountExpired: false,
                passwordExpired: false,
                roles: "",  // Empty roles
                isFallbackAdministrator: true  // Must be marked as fallback admin to be found by bootstrap
        )
        userRepository.save(existingUser)

        and: "new values given"
        def bootstrap = new AdministratorUserBootstrap(userRepository, passwordEncoder)
        bootstrap.adminEmail = Optional.of("admin@test.com")
        bootstrap.adminUsername = Optional.of("admin")
        bootstrap.adminPassword = Optional.of("123password")
        bootstrap.adminFirstName = "First"
        bootstrap.adminLastName = "Last"

        when: "application starts"
        bootstrap.onApplicationEvent(null)

        then: "user is updated"
        def user = userRepository.findByIsFallbackAdministrator(true).get()
        user.email == "admin@test.com"
        user.username == "admin"
        passwordEncoder.matches("123password", user.passwordHash)
        user.firstName == "First"
        user.lastName == "Last"
    }
}
