package org.leargon.backend.repository

import groovy.transform.CompileStatic
import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessDomainVersion

@CompileStatic
@Repository
interface BusinessDomainVersionRepository extends JpaRepository<BusinessDomainVersion, Long> {

    @Join(value = "changedBy", type = Join.Type.FETCH)
    List<BusinessDomainVersion> findByBusinessDomainIdOrderByVersionNumberDesc(Long businessDomainId)

    @Join(value = "changedBy", type = Join.Type.FETCH)
    Optional<BusinessDomainVersion> findByBusinessDomainIdAndVersionNumber(Long businessDomainId, Integer versionNumber)

    Optional<BusinessDomainVersion> findFirstByBusinessDomainIdOrderByVersionNumberDesc(Long businessDomainId)
}
