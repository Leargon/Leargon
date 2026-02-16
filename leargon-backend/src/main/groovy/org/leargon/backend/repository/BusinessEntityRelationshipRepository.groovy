package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntityRelationship

@Repository
interface BusinessEntityRelationshipRepository extends JpaRepository<BusinessEntityRelationship, Long> {

    @Join(value = "firstBusinessEntity", type = Join.Type.FETCH)
    @Join(value = "secondBusinessEntity", type = Join.Type.FETCH)
    Optional<BusinessEntityRelationship> findById(Long id)

    @Join(value = "firstBusinessEntity", type = Join.Type.FETCH)
    @Join(value = "secondBusinessEntity", type = Join.Type.FETCH)
    List<BusinessEntityRelationship> findByFirstBusinessEntityIdOrSecondBusinessEntityId(Long firstId, Long secondId)
}
