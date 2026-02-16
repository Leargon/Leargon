package org.leargon.backend.controller

import io.micronaut.context.annotation.Value
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.token.generator.TokenGenerator
import jakarta.annotation.Nullable
import jakarta.validation.Valid
import org.leargon.backend.api.AuthenticationApi
import org.leargon.backend.domain.User
import org.leargon.backend.model.AuthResponse
import org.leargon.backend.model.AzureConfigResponse
import org.leargon.backend.model.AzureLoginRequest
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.model.SignupRequest
import org.leargon.backend.exception.AuthenticationException
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.mapper.UserMapper
import org.leargon.backend.service.AzureAuthService
import org.leargon.backend.service.AuthenticationService
import org.leargon.backend.service.UserService

import java.time.Instant

@Controller
@Secured(SecurityRule.IS_ANONYMOUS)
class AuthenticationController implements AuthenticationApi {

    private static final Long TOKEN_EXPIRATION_SECONDS = 3600L

    private final UserService userService
    private final AuthenticationService authenticationService
    private final TokenGenerator tokenGenerator
    private final UserMapper userMapper
    private final AzureAuthService azureAuthService
    private final String azureTenantId
    private final String azureClientId

    AuthenticationController(
            UserService userService,
            AuthenticationService authenticationService,
            TokenGenerator tokenGenerator,
            UserMapper userMapper,
            @Nullable AzureAuthService azureAuthService,
            @Value('${azure.tenant-id:}') String azureTenantId,
            @Value('${azure.client-id:}') String azureClientId
    ) {
        this.userService = userService
        this.authenticationService = authenticationService
        this.tokenGenerator = tokenGenerator
        this.userMapper = userMapper
        this.azureAuthService = azureAuthService
        this.azureTenantId = azureTenantId
        this.azureClientId = azureClientId
    }

    @Override
    AuthResponse signup(@Valid @Body SignupRequest signupRequest) {
        User user = userService.createUser(signupRequest)
        return generateAuthResponse(user)
    }

    @Override
    AuthResponse login(@Valid @Body LoginRequest loginRequest) {
        User user = authenticationService.authenticate(loginRequest)
        user = userService.updateLastLogin(user.id)
        return generateAuthResponse(user)
    }

    @Override
    AuthResponse azureLogin(@Valid @Body AzureLoginRequest azureLoginRequest) {
        if (azureAuthService == null) {
            throw new AuthenticationException("Azure login is not configured")
        }
        User user = azureAuthService.authenticateWithAzure(azureLoginRequest.idToken)
        return generateAuthResponse(user)
    }

    @Override
    AzureConfigResponse getAzureConfig() {
        boolean enabled = azureAuthService != null && azureTenantId && azureClientId
        def response = new AzureConfigResponse(enabled)
        if (enabled) {
            response.tenantId(azureTenantId)
            response.clientId(azureClientId)
        }
        return response
    }

    private AuthResponse generateAuthResponse(User user) {
        List<String> roles = userService.getUserRoles(user)

        Map<String, Object> claims = [
                sub: user.email,
                roles: roles,
                userId: user.id,
                email: user.email,
                username: user.username,
                iat: Instant.now().epochSecond
        ]

        String token = tokenGenerator.generateToken(claims)
                .orElseThrow(() -> new ResourceNotFoundException("Failed to generate authentication token"))

        return new AuthResponse(
                token,
                "Bearer",
                TOKEN_EXPIRATION_SECONDS.intValue(),
                userMapper.toUserResponse(user)
        )
    }
}
