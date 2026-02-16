package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.Classification

@Repository
interface ClassificationRepository extends JpaRepository<Classification, Long> {

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
