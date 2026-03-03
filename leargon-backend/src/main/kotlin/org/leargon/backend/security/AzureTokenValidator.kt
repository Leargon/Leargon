package org.leargon.backend.security

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.jwk.source.JWKSourceBuilder
import com.nimbusds.jose.proc.JWSVerificationKeySelector
import com.nimbusds.jose.proc.SecurityContext
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier
import com.nimbusds.jwt.proc.DefaultJWTProcessor
import io.micronaut.context.annotation.Requires
import io.micronaut.context.annotation.Value
import jakarta.inject.Singleton
import org.leargon.backend.exception.AuthenticationException
import org.slf4j.LoggerFactory
import java.net.URI

@Singleton
@Requires(property = "azure.tenant-id", notEquals = "")
open class AzureTokenValidator(
    @Value("\${azure.tenant-id}") private val tenantId: String,
    @Value("\${azure.client-id}") private val clientId: String
) {

    companion object {
        private val LOG = LoggerFactory.getLogger(AzureTokenValidator::class.java)
    }

    private val jwtProcessor: DefaultJWTProcessor<SecurityContext>

    init {
        if (tenantId.isEmpty() || clientId.isEmpty()) {
            throw IllegalArgumentException("Azure tenant-id and client-id must both be set")
        }

        val jwksUrl = URI("https://login.microsoftonline.com/$tenantId/discovery/v2.0/keys").toURL()
        val jwkSource = JWKSourceBuilder.create<SecurityContext>(jwksUrl).build()

        val keySelector = JWSVerificationKeySelector<SecurityContext>(
            JWSAlgorithm.RS256,
            jwkSource
        )

        jwtProcessor = DefaultJWTProcessor<SecurityContext>()
        jwtProcessor.jwsKeySelector = keySelector

        val expectedIssuer = "https://login.microsoftonline.com/$tenantId/v2.0"
        val claimsVerifier = DefaultJWTClaimsVerifier<SecurityContext>(
            JWTClaimsSet.Builder()
                .issuer(expectedIssuer)
                .audience(clientId)
                .build(),
            HashSet(listOf("sub", "iat", "exp", "iss", "aud"))
        )
        jwtProcessor.jwtClaimsSetVerifier = claimsVerifier
    }

    open fun validate(idToken: String): Map<String, String> {
        try {
            val claims = jwtProcessor.process(idToken, null)

            val email = claims.getStringClaim("email") ?: claims.getStringClaim("preferred_username")
            val oid = claims.getStringClaim("oid")

            if (email.isNullOrEmpty()) {
                throw AuthenticationException("Azure token missing email claim")
            }
            if (oid.isNullOrEmpty()) {
                throw AuthenticationException("Azure token missing oid claim")
            }

            return mapOf(
                "email" to email,
                "oid" to oid,
                "givenName" to (claims.getStringClaim("given_name") ?: ""),
                "familyName" to (claims.getStringClaim("family_name") ?: ""),
                "name" to (claims.getStringClaim("name") ?: "")
            )
        } catch (e: AuthenticationException) {
            throw e
        } catch (e: Exception) {
            LOG.warn("Azure token validation failed: {}", e.message)
            throw AuthenticationException("Invalid Azure token: ${e.message}")
        }
    }
}
