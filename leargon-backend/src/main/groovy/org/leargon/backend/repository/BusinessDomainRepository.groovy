package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessDomain

@Repository
interface BusinessDomainRepository extends JpaRepository<BusinessDomain, Long> {

    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "assignedEntities", type = Join.Type.LEFT_FETCH)
    List<BusinessDomain> findAll()

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "assignedEntities", type = Join.Type.LEFT_FETCH)
    List<BusinessDomain> findByParentIsNull()

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "assignedEntities", type = Join.Type.LEFT_FETCH)
    Optional<BusinessDomain> findById(Long id)

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "assignedEntities", type = Join.Type.LEFT_FETCH)
    Optional<BusinessDomain> findByKey(String key)

    List<BusinessDomain> findByParentId(Long parentId)

    boolean existsByParentId(Long parentId)
}
