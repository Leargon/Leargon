package org.leargon.backend.security

import io.micronaut.http.HttpRequest
import io.micronaut.security.authentication.AuthenticationRequest
import io.micronaut.security.authentication.AuthenticationResponse
import io.micronaut.security.authentication.provider.ReactiveAuthenticationProvider
import jakarta.inject.Singleton
import org.leargon.backend.model.LoginRequest
import org.leargon.backend.service.AuthenticationService
import org.leargon.backend.service.UserService
import org.reactivestreams.Publisher
import reactor.core.publisher.Mono

@Singleton
open class UserPasswordAuthenticationProvider(
    private val authenticationService: AuthenticationService,
    private val userService: UserService
) : ReactiveAuthenticationProvider<HttpRequest<*>, String, String> {

    override fun authenticate(
        requestContext: HttpRequest<*>?,
        authenticationRequest: AuthenticationRequest<String, String>
    ): Publisher<AuthenticationResponse> {
        return Mono.create { emitter ->
            try {
                val loginRequest = LoginRequest(
                    authenticationRequest.identity,
                    authenticationRequest.secret
                )

                val user = authenticationService.authenticate(loginRequest)
                userService.updateLastLogin(user.id!!)

                emitter.success(AuthenticationResponse.success(
                    user.email,
                    listOf("ROLE_USER"),
                    mapOf(
                        "userId" to user.id,
                        "email" to user.email,
                        "username" to user.username
                    )
                ))
            } catch (e: Exception) {
                emitter.error(AuthenticationResponse.exception(e.message))
            }
        }
    }
}
