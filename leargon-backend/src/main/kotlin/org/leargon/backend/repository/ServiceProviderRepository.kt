package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ServiceProvider
import java.util.Optional

@Repository
interface ServiceProviderRepository : JpaRepository<ServiceProvider, Long> {
    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<ServiceProvider>

    @Join(value = "linkedProcesses", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<ServiceProvider>

    fun existsByKey(key: String): Boolean

    fun findByLinkedProcessesKey(processKey: String): List<ServiceProvider>
}
