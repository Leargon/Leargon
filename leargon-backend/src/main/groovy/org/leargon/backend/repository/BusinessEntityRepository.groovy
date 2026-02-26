package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.BusinessEntity

@Repository
interface BusinessEntityRepository extends JpaRepository<BusinessEntity, Long> {

    @Query(value = "SELECT COUNT(*) FROM business_entities WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%') OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')", nativeQuery = true)
    long countByLocaleInTranslations(String localeCode)

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    List<BusinessEntity> findAll()

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    Optional<BusinessEntity> findById(Long id)

    @Join(value = "dataOwner", type = Join.Type.FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    @Join(value = "children", type = Join.Type.LEFT_FETCH)
    @Join(value = "businessDomain", type = Join.Type.LEFT_FETCH)
    @Join(value = "interfaceEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "implementationEntities", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsFirst", type = Join.Type.LEFT_FETCH)
    @Join(value = "relationshipsSecond", type = Join.Type.LEFT_FETCH)
    Optional<BusinessEntity> findByKey(String key)

    List<BusinessEntity> findByDataOwnerId(Long dataOwnerId)

    List<BusinessEntity> findByParentIsNull()
}
