package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntityVersion

@Repository
interface BusinessEntityVersionRepository extends JpaRepository<BusinessEntityVersion, Long> {

    @Join(value = "changedBy", type = Join.Type.FETCH)
    List<BusinessEntityVersion> findByBusinessEntityIdOrderByVersionNumberDesc(Long BusinessEntityId)

    @Join(value = "changedBy", type = Join.Type.FETCH)
    Optional<BusinessEntityVersion> findByBusinessEntityIdAndVersionNumber(Long BusinessEntityId, Integer versionNumber)

    Optional<BusinessEntityVersion> findFirstByBusinessEntityIdOrderByVersionNumberDesc(Long BusinessEntityId)
}
