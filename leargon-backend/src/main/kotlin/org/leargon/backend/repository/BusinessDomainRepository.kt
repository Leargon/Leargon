package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessDomain
import java.util.Optional

@Repository
interface BusinessDomainRepository : JpaRepository<BusinessDomain, Long> {
    @Query(
        value =
            "SELECT COUNT(*) FROM business_domains WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')" +
                " OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')",
        nativeQuery = true
    )
    fun countByLocaleInTranslations(localeCode: String): Long

    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "boundedContexts", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    override fun findAll(): List<BusinessDomain>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    fun findByParentIsNull(): List<BusinessDomain>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "boundedContexts", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    override fun findById(id: Long): Optional<BusinessDomain>

    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "parent", type = Join.Type.LEFT_FETCH)
    @Join(value = "boundedContexts", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    fun findByKey(key: String): Optional<BusinessDomain>
}
