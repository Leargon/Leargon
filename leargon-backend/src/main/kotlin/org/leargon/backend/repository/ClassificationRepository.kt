package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Query
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Classification
import java.util.Optional

@Repository
interface ClassificationRepository : JpaRepository<Classification, Long> {
    @Query(
        value =
            "SELECT COUNT(*) FROM classifications WHERE names LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')" +
                " OR descriptions LIKE CONCAT('%\"locale\":\"', :localeCode, '\"%')",
        nativeQuery = true
    )
    fun countByLocaleInTranslations(localeCode: String): Long

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    fun findByKey(key: String): Optional<Classification>

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    fun findByAssignableTo(assignableTo: String): List<Classification>

    @Join(value = "values", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.FETCH)
    override fun findAll(): List<Classification>
}
