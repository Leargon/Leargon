package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Classification

@Repository
interface ClassificationRepository extends JpaRepository<Classification, Long> {

    @Query(value = "SELECT COUNT(*) FROM classifications WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%') OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')", nativeQuery = true)
    long countByLocaleInTranslations(String localeCode)

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    Optional<Classification> findByKey(String key)

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    List<Classification> findByAssignableTo(String assignableTo)

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    List<Classification> findAll()
}
