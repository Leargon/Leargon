package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntity
import java.util.Optional

@Repository
interface BusinessEntityRepository : JpaRepository<BusinessEntity, Long> {

    @Query(value = "SELECT COUNT(*) FROM business_entities WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%') OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')", nativeQuery = true)
    fun countByLocaleInTranslations(localeCode: String): Long

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    @Join(value = "dataProcessors", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<BusinessEntity>

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    @Join(value = "dataProcessors", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): Optional<BusinessEntity>

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    @Join(value = "dataProcessors", type = Join.Type.LEFT_FETCH)
    fun findByKey(key: String): Optional<BusinessEntity>

    fun findByDataOwnerId(dataOwnerId: Long): List<BusinessEntity>

    fun findByParentIsNull(): List<BusinessEntity>
}
