package org.leargon.backend.repository

import groovy.transform.CompileStatic
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ProcessFlow

@CompileStatic
@Repository
interface ProcessFlowRepository extends JpaRepository<ProcessFlow, Long> {

    List<ProcessFlow> findByProcessId(Long processId)

    void deleteByProcessId(Long processId)
}
