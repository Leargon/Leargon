package org.leargon.backend.security

import jakarta.inject.Singleton
import io.micronaut.core.annotation.Nullable
import io.micronaut.http.HttpRequest
import io.micronaut.security.authentication.AuthenticationProvider
import io.micronaut.security.authentication.AuthenticationRequest
import io.micronaut.security.authentication.AuthenticationResponse
import org.leargon.backend.domain.User
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.service.AuthenticationService
import org.leargon.backend.service.UserService
import org.reactivestreams.Publisher
import reactor.core.publisher.Mono

@Singleton
class UserPasswordAuthenticationProvider implements AuthenticationProvider<HttpRequest<?>> {

    private final AuthenticationService authenticationService
    private final UserService userService

    UserPasswordAuthenticationProvider(AuthenticationService authenticationService, UserService userService) {
        this.authenticationService = authenticationService
        this.userService = userService
    }

    @Override
    Publisher<AuthenticationResponse> authenticate(
            @Nullable HttpRequest<?> httpRequest,
            AuthenticationRequest<?, ?> authenticationRequest
    ) {
        return Mono.create { emitter ->
            try {
                LoginRequest loginRequest = new LoginRequest()
                        .email(authenticationRequest.identity as String)
                        .password(authenticationRequest.secret as String)

                User user = authenticationService.authenticate(loginRequest)

                // Update last login timestamp
                userService.updateLastLogin(user.id)

                // Return authentication response with user claims
                emitter.success(AuthenticationResponse.success(
                        user.email,
                        ["ROLE_USER"],
                        [
                                userId: user.id,
                                email: user.email,
                                username: user.username
                        ]
                ))
            } catch (Exception e) {
                emitter.error(AuthenticationResponse.exception(e.message))
            }
        }
    }
}
