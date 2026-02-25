package org.leargon.backend.service

import io.micronaut.context.annotation.Requires
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.AzureTokenValidator
import org.leargon.backend.security.PasswordEncoder
import org.slf4j.Logger
import org.slf4j.LoggerFactory

import java.time.Instant

@Singleton
@Requires(bean = AzureTokenValidator)
class AzureAuthService {

    private static final Logger LOG = LoggerFactory.getLogger(AzureAuthService)

    private final AzureTokenValidator tokenValidator
    private final UserRepository userRepository

    AzureAuthService(AzureTokenValidator tokenValidator, UserRepository userRepository) {
        this.tokenValidator = tokenValidator
        this.userRepository = userRepository
    }

    @Transactional
    User authenticateWithAzure(String idToken) {
        Map<String, String> claims = tokenValidator.validate(idToken)

        String oid = claims.oid
        String email = claims.email
        String givenName = claims.givenName
        String familyName = claims.familyName

        // Fall back to splitting the full 'name' claim when given_name/family_name are absent
        if (!givenName && !familyName && claims.name) {
            String[] parts = claims.name.trim().split(" ", 2)
            givenName = parts[0]
            familyName = parts.length > 1 ? parts[1] : ""
        }

        // 1. Find by Azure OID (returning user)
        def userRepo = this.userRepository
        Optional<User> byOid = userRepo.findByAzureOid(oid)
        if (byOid.isPresent()) {
            User user = byOid.get()
            user.lastLoginAt = Instant.now()
            if (givenName) user.firstName = givenName
            if (familyName) user.lastName = familyName
            return userRepo.update(user)
        }

        // 2. Find by email (link existing user)
        Optional<User> byEmail = userRepo.findByEmail(email)
        if (byEmail.isPresent()) {
            User user = byEmail.get()
            user.azureOid = oid
            user.authProvider = user.authProvider ?: "AZURE"
            user.lastLoginAt = Instant.now()
            if (givenName) user.firstName = givenName
            if (familyName) user.lastName = familyName
            return userRepo.update(user)
        }

        // 3. Create new user
        LOG.info("Creating new Azure user: {}", email)
        String username = generateUsername(email)
        User user = new User()
        user.email = email
        user.username = username
        user.firstName = givenName ?: "Azure"
        user.lastName = familyName ?: "User"
        user.azureOid = oid
        user.authProvider = "AZURE"
        user.roles = "ROLE_USER"
        user.enabled = true
        user.accountLocked = false
        user.accountExpired = false
        user.passwordExpired = false
        user.isFallbackAdministrator = false
        user.setupCompleted = false
        user.preferredLanguage = "en"
        user.lastLoginAt = Instant.now()
        return userRepo.save(user)
    }

    private String generateUsername(String email) {
        def userRepo = this.userRepository
        String base = email.split("@")[0].replaceAll("[^a-zA-Z0-9]", "").toLowerCase()
        if (base.length() < 3) base = base + "user"
        String candidate = base
        int counter = 1
        while (userRepo.existsByUsername(candidate)) {
            candidate = "${base}${counter}"
            counter++
        }
        return candidate
    }
}
