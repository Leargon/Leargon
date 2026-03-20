package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.User
import java.util.Optional

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): Optional<User>

    fun findByUsername(username: String): Optional<User>

    fun existsByEmail(email: String): Boolean

    fun existsByUsername(username: String): Boolean

    fun findByIsFallbackAdministrator(value: Boolean): Optional<User>

    fun findByAzureOid(azureOid: String): Optional<User>
}
