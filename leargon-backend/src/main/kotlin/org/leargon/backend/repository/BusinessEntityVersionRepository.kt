package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntityVersion
import java.util.Optional

@Repository
interface BusinessEntityVersionRepository : JpaRepository<BusinessEntityVersion, Long> {

    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByBusinessEntityIdOrderByVersionNumberDesc(businessEntityId: Long): List<BusinessEntityVersion>

    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByBusinessEntityIdAndVersionNumber(businessEntityId: Long, versionNumber: Int): Optional<BusinessEntityVersion>

    fun findFirstByBusinessEntityIdOrderByVersionNumberDesc(businessEntityId: Long): Optional<BusinessEntityVersion>
}
