package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.ClassificationValue

@Repository
interface ClassificationValueRepository extends JpaRepository<ClassificationValue, Long> {
}
