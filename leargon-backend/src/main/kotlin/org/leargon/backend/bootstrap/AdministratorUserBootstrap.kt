package org.leargon.backend.bootstrap

import io.micronaut.context.annotation.Value
import io.micronaut.context.event.ApplicationEventListener
import io.micronaut.context.event.StartupEvent
import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import org.slf4j.LoggerFactory
import java.util.Optional

@Singleton
open class AdministratorUserBootstrap(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) : ApplicationEventListener<StartupEvent> {
    companion object {
        private val LOG = LoggerFactory.getLogger(AdministratorUserBootstrap::class.java)
    }

    @Value("\${admin.email:}")
    lateinit var adminEmail: Optional<String>

    @Value("\${admin.username:}")
    lateinit var adminUsername: Optional<String>

    @Value("\${admin.password:}")
    lateinit var adminPassword: Optional<String>

    @Value("\${admin.firstName:System}")
    var adminFirstName: String = "System"

    @Value("\${admin.lastName:Administrator}")
    var adminLastName: String = "Administrator"

    override fun onApplicationEvent(event: StartupEvent?) {
        if (!adminEmail.isPresent || !adminUsername.isPresent || !adminPassword.isPresent) {
            LOG.debug("Admin bootstrap skipped - environment variables not set")
            LOG.debug("Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD to create fallback admin")
            return
        }

        val email = adminEmail.get()
        val username = adminUsername.get()
        val password = adminPassword.get()

        if (email.isBlank() || username.isBlank() || password.isBlank()) {
            LOG.warn("Administrator bootstrap skipped - empty credentials provided")
            return
        }

        if (password.length < 8) {
            LOG.error("Administrator bootstrap failed - password must be at least 8 characters")
            return
        }

        try {
            val existingUser = userRepository.findByIsFallbackAdministrator(true)

            if (existingUser.isPresent) {
                val user = existingUser.get()
                LOG.info("Updating fallback admin: {}", email)
                user.email = email
                user.username = username
                if (!passwordEncoder.matches(password, user.passwordHash)) {
                    user.passwordHash = passwordEncoder.encode(password)
                }
                user.firstName = adminFirstName
                user.lastName = adminLastName
                user.enabled = true
                user.roles = "ROLE_ADMIN"
                user.isFallbackAdministrator = true
                userRepository.update(user)
                LOG.info("Successfully updated fallback admin {}", email)
                return
            }

            LOG.info("Creating fallback admin user: {}", email)
            val adminUser = User()
            adminUser.email = email
            adminUser.username = username
            adminUser.passwordHash = passwordEncoder.encode(password)
            adminUser.firstName = adminFirstName
            adminUser.lastName = adminLastName
            adminUser.enabled = true
            adminUser.roles = "ROLE_ADMIN"
            adminUser.isFallbackAdministrator = true

            userRepository.save(adminUser)
            LOG.info("Successfully created fallback admin user: {}", email)
            LOG.warn("SECURITY: Change admin password after first login!")
        } catch (e: Exception) {
            LOG.error("Failed to create fallback admin user: {}", e.message, e)
        }
    }
}
