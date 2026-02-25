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
import org.slf4j.Logger
import org.slf4j.LoggerFactory

@Singleton
@Requires(property = "azure.tenant-id", notEquals = "")
class AzureTokenValidator {

    private static final Logger LOG = LoggerFactory.getLogger(AzureTokenValidator)

    private final String tenantId
    private final String clientId
    private final DefaultJWTProcessor<SecurityContext> jwtProcessor

    AzureTokenValidator(
            @Value('${azure.tenant-id}') String tenantId,
            @Value('${azure.client-id}') String clientId
    ) {
        this.tenantId = tenantId
        this.clientId = clientId

        if (!tenantId || !clientId) {
            throw new IllegalArgumentException("Azure tenant-id and client-id must both be set")
        }

        def jwksUrl = new URL("https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys")
        def jwkSource = JWKSourceBuilder.create(jwksUrl).build()

        def keySelector = new JWSVerificationKeySelector<SecurityContext>(
                JWSAlgorithm.RS256,
                jwkSource
        )

        jwtProcessor = new DefaultJWTProcessor<SecurityContext>()
        jwtProcessor.setJWSKeySelector(keySelector)

        def expectedIssuer = "https://login.microsoftonline.com/${tenantId}/v2.0"
        def claimsVerifier = new DefaultJWTClaimsVerifier<SecurityContext>(
                new JWTClaimsSet.Builder()
                        .issuer(expectedIssuer)
                        .audience(clientId)
                        .build(),
                new HashSet<>(["sub", "iat", "exp", "iss", "aud"])
        )
        jwtProcessor.setJWTClaimsSetVerifier(claimsVerifier)
    }

    /**
     * Validates an Azure ID token and extracts claims.
     *
     * @param idToken The raw ID token string from MSAL
     * @return Map with keys: email, oid, givenName, familyName
     * @throws AuthenticationException if the token is invalid
     */
    Map<String, String> validate(String idToken) {
        try {
            JWTClaimsSet claims = jwtProcessor.process(idToken, null)

            String email = claims.getStringClaim("email") ?: claims.getStringClaim("preferred_username")
            String oid = claims.getStringClaim("oid")

            if (!email) {
                throw new AuthenticationException("Azure token missing email claim")
            }
            if (!oid) {
                throw new AuthenticationException("Azure token missing oid claim")
            }

            return [
                    email     : email,
                    oid       : oid,
                    givenName : claims.getStringClaim("given_name") ?: "",
                    familyName: claims.getStringClaim("family_name") ?: "",
                    name      : claims.getStringClaim("name") ?: ""
            ]
        } catch (AuthenticationException e) {
            throw e
        } catch (Exception e) {
            LOG.warn("Azure token validation failed: {}", e.message)
            throw new AuthenticationException("Invalid Azure token: ${e.message}")
        }
    }
}
