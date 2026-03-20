package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessDomainVersion
import java.util.Optional

@Repository
interface BusinessDomainVersionRepository : JpaRepository<BusinessDomainVersion, Long> {
    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByBusinessDomainIdOrderByVersionNumberDesc(businessDomainId: Long): List<BusinessDomainVersion>

    @Join(value = "changedBy", type = Join.Type.FETCH)
    fun findByBusinessDomainIdAndVersionNumber(
        businessDomainId: Long,
        versionNumber: Int
    ): Optional<BusinessDomainVersion>

    fun findFirstByBusinessDomainIdOrderByVersionNumberDesc(businessDomainId: Long): Optional<BusinessDomainVersion>
}
