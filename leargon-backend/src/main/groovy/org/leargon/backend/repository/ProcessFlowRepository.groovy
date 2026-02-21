package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessFlow

@Repository
interface ProcessFlowRepository extends JpaRepository<ProcessFlow, Long> {

    List<ProcessFlow> findByProcessId(Long processId)

    void deleteByProcessId(Long processId)
}
