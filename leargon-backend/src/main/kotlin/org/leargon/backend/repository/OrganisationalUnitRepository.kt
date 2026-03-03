package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.OrganisationalUnit
import java.util.Optional

@Repository
interface OrganisationalUnitRepository : JpaRepository<OrganisationalUnit, Long> {

    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<OrganisationalUnit>

    @Query("SELECT DISTINCT ou FROM OrganisationalUnit ou LEFT JOIN FETCH ou.children LEFT JOIN FETCH ou.createdBy LEFT JOIN FETCH ou.lead WHERE ou.parents IS EMPTY")
    fun findRoots(): List<OrganisationalUnit>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<OrganisationalUnit>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): Optional<OrganisationalUnit>

    fun findByLeadId(leadId: Long): List<OrganisationalUnit>
}
