package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntityRelationship
import java.util.Optional

@Repository
interface BusinessEntityRelationshipRepository : JpaRepository<BusinessEntityRelationship, Long> {
    @Join(value = "firstBusinessEntity", type = Join.Type.FETCH)
    @Join(value = "secondBusinessEntity", type = Join.Type.FETCH)
    override fun findById(id: Long): Optional<BusinessEntityRelationship>
}
