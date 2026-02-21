package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessElement

@Repository
interface ProcessElementRepository extends JpaRepository<ProcessElement, Long> {

    @Join(value = "linkedProcess", type = Join.Type.LEFT_FETCH)
    @Join(value = "linkedEntity", type = Join.Type.LEFT_FETCH)
    List<ProcessElement> findByProcessIdOrderBySortOrder(Long processId)

    void deleteByProcessId(Long processId)

    List<ProcessElement> findByLinkedProcessId(Long linkedProcessId)
}
