package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.User

@Repository
interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email)

    Optional<User> findByUsername(String username)

    boolean existsByEmail(String email)

    boolean existsByUsername(String username)

    Optional<User> findByIsFallbackAdministrator(boolean value)

    Optional<User> findByAzureOid(String azureOid)
}
