package org.leargon.backend.repository

import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ClassificationValue

@Repository
interface ClassificationValueRepository extends JpaRepository<ClassificationValue, Long> {

    @Query(value = "SELECT COUNT(*) FROM classification_values WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%') OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')", nativeQuery = true)
    long countByLocaleInTranslations(String localeCode)
}
