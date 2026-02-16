package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessVersion

@Repository
interface ProcessVersionRepository extends JpaRepository<ProcessVersion, Long> {

    @Join(value = "changedBy", type = Join.Type.FETCH)
    List<ProcessVersion> findByProcessIdOrderByVersionNumberDesc(Long processId)

    @Join(value = "changedBy", type = Join.Type.FETCH)
    Optional<ProcessVersion> findByProcessIdAndVersionNumber(Long processId, Integer versionNumber)

    Optional<ProcessVersion> findFirstByProcessIdOrderByVersionNumberDesc(Long processId)
}
