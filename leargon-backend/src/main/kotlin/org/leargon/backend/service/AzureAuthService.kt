package org.leargon.backend.service

import io.micronaut.context.annotation.Requires
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.User
import org.leargon.backend.repository.UserRepository
import org.leargon.backend.security.AzureTokenValidator
import org.slf4j.LoggerFactory
import java.time.Instant

@Singleton
@Requires(bean = AzureTokenValidator::class)
open class AzureAuthService(
    private val tokenValidator: AzureTokenValidator,
    private val userRepository: UserRepository
) {

    companion object {
        private val LOG = LoggerFactory.getLogger(AzureAuthService::class.java)
    }

    @Transactional
    open fun authenticateWithAzure(idToken: String): User {
        val claims = tokenValidator.validate(idToken)

        val oid = claims["oid"]!!
        val email = claims["email"]!!
        var givenName = claims["givenName"] ?: ""
        var familyName = claims["familyName"] ?: ""

        if (givenName.isEmpty() && familyName.isEmpty() && !claims["name"].isNullOrEmpty()) {
            val parts = claims["name"]!!.trim().split(" ", limit = 2)
            givenName = parts[0]
            familyName = if (parts.size > 1) parts[1] else ""
        }

        val byOid = userRepository.findByAzureOid(oid)
        if (byOid.isPresent) {
            val user = byOid.get()
            user.lastLoginAt = Instant.now()
            if (givenName.isNotEmpty()) user.firstName = givenName
            if (familyName.isNotEmpty()) user.lastName = familyName
            return userRepository.update(user)
        }

        val byEmail = userRepository.findByEmail(email)
        if (byEmail.isPresent) {
            val user = byEmail.get()
            user.azureOid = oid
            user.authProvider = user.authProvider ?: "AZURE"
            user.lastLoginAt = Instant.now()
            if (givenName.isNotEmpty()) user.firstName = givenName
            if (familyName.isNotEmpty()) user.lastName = familyName
            return userRepository.update(user)
        }

        LOG.info("Creating new Azure user: {}", email)
        val username = generateUsername(email)
        val user = User()
        user.email = email
        user.username = username
        user.firstName = givenName.ifEmpty { "Azure" }
        user.lastName = familyName.ifEmpty { "User" }
        user.azureOid = oid
        user.authProvider = "AZURE"
        user.roles = "ROLE_USER"
        user.enabled = true
        user.isFallbackAdministrator = false
        user.setupCompleted = false
        user.preferredLanguage = "en"
        user.lastLoginAt = Instant.now()
        return userRepository.save(user)
    }

    private fun generateUsername(email: String): String {
        var base = email.split("@")[0].replace(Regex("[^a-zA-Z0-9]"), "").lowercase()
        if (base.length < 3) base = "${base}user"
        var candidate = base
        var counter = 1
        while (userRepository.existsByUsername(candidate)) {
            candidate = "$base$counter"
            counter++
        }
        return candidate
    }
}
