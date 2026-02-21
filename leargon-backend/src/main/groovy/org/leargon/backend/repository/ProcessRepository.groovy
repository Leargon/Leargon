package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Process

@Repository
interface ProcessRepository extends JpaRepository<Process, Long> {

    @Join(value = "processOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "inputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "outputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    List<Process> findAll()

    @Join(value = "processOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "inputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "outputEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    Optional<Process> findByKey(String key)

    Optional<Process> findByCode(String code)

    List<Process> findByParentId(Long parentId)

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    List<Process> findByParentIsNull()
}
