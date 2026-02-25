package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.OrganisationalUnit

@Repository
interface OrganisationalUnitRepository extends JpaRepository<OrganisationalUnit, Long> {

    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    List<OrganisationalUnit> findAll()

    @Query("SELECT DISTINCT ou FROM OrganisationalUnit ou LEFT JOIN FETCH ou.children LEFT JOIN FETCH ou.createdBy LEFT JOIN FETCH ou.lead WHERE ou.parents IS EMPTY")
    List<OrganisationalUnit> findRoots()

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    Optional<OrganisationalUnit> findByKey(String key)

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parents", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "lead", type = Join.Type.LEFT_FETCH)
    Optional<OrganisationalUnit> findById(Long id)

    List<OrganisationalUnit> findByLeadId(Long leadId)
}
