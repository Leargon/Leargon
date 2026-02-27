package org.leargon.backend.bootstrap

import io.micronaut.context.annotation.Value
import io.micronaut.context.event.ApplicationEventListener
import io.micronaut.context.event.StartupEvent
import jakarta.inject.Singleton
import org.leargon.backend.domain.User
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.PasswordEncoder
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Bootstrap service to create fallback admin user on application startup.
 *
 * This creates an admin user if one doesn't exist and the following environment
 * variables are set:
 * - ADMIN_EMAIL
 * - ADMIN_USERNAME
 * - ADMIN_PASSWORD
 * - ADMIN_FIRST_NAME (optional, defaults to "System")
 * - ADMIN_LAST_NAME (optional, defaults to "Administrator")
 *
 * Security notes:
 * - Only creates admin if no admin users exist
 * - Passwords are BCrypt hashed with strength 12
 * - Environment variables should be set securely (not in version control)
 * - Change password after first login in production
 */
@Singleton
class AdministratorUserBootstrap implements ApplicationEventListener<StartupEvent> {

    private static final Logger LOG = LoggerFactory.getLogger(AdministratorUserBootstrap)

    private final UserRepository userRepository
    private final PasswordEncoder passwordEncoder

    @Value('${admin.email:}')
    Optional<String> adminEmail

    @Value('${admin.username:}')
    Optional<String> adminUsername

    @Value('${admin.password:}')
    Optional<String> adminPassword

    @Value('${admin.firstName:System}')
    String adminFirstName

    @Value('${admin.lastName:Administrator}')
    String adminLastName

    AdministratorUserBootstrap(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository
        this.passwordEncoder = passwordEncoder
    }

    @Override
    void onApplicationEvent(StartupEvent event) {
        // Only create admin if environment variables are configured
        if (!adminEmail.isPresent() || !adminUsername.isPresent() || !adminPassword.isPresent()) {
            LOG.debug("Admin bootstrap skipped - environment variables not set")
            LOG.debug("Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD to create fallback admin")
            return
        }

        String email = adminEmail.get()
        String username = adminUsername.get()
        String password = adminPassword.get()

        // Validate credentials
        if (email.isBlank() || username.isBlank() || password.isBlank()) {
            LOG.warn("Administrator bootstrap skipped - empty credentials provided")
            return
        }

        if (password.length() < 8) {
            LOG.error("Administrator bootstrap failed - password must be at least 8 characters")
            return
        }

        try {
            // Check if admin user already exists
            Optional<User> existingUser = userRepository.findByIsFallbackAdministrator(true)

            if (existingUser.isPresent()) {
                User user = existingUser.get()

                // User exists update with new values
                LOG.info("Updating fallback admin: {}", email)
                user.email = email
                user.username = username
                user.passwordHash = passwordEncoder.encode(password)
                user.firstName = adminFirstName
                user.lastName = adminLastName
                user.enabled = true
                user.roles = 'ROLE_ADMIN'
                user.isFallbackAdministrator = true
                userRepository.update(user)
                LOG.info("Successfully updated fallback admin {}", email)
                return
            }

            // Create new admin user
            LOG.info("Creating fallback admin user: {}", email)

            User adminUser = new User(
                email: email,
                username: username,
                passwordHash: passwordEncoder.encode(password),
                firstName: adminFirstName,
                lastName: adminLastName,
                enabled: true,
                roles: 'ROLE_ADMIN',
                isFallbackAdministrator: true
            )

            userRepository.save(adminUser)
            LOG.info("Successfully created fallback admin user: {}", email)
            LOG.warn("SECURITY: Change admin password after first login!")

        } catch (Exception e) {
            LOG.error("Failed to create fallback admin user: {}", e.message, e)
        }
    }
}
