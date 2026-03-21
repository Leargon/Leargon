package org.leargon.backend.repository

import io.micronaut.data.annotation.Join
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.TranslationLink

@Repository
interface TranslationLinkRepository : JpaRepository<TranslationLink, Long> {
    @Join(value = "firstEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "secondEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findByFirstEntityKey(key: String): List<TranslationLink>

    @Join(value = "firstEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "secondEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    fun findBySecondEntityKey(key: String): List<TranslationLink>

    @Join(value = "firstEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "secondEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findById(id: Long): java.util.Optional<TranslationLink>

    @Join(value = "firstEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "secondEntity", type = Join.Type.LEFT_FETCH)
    @Join(value = "createdBy", type = Join.Type.LEFT_FETCH)
    override fun findAll(): List<TranslationLink>

    fun existsByFirstEntityIdAndSecondEntityId(
        firstEntityId: Long,
        secondEntityId: Long
    ): Boolean

    fun deleteByFirstEntityId(entityId: Long)

    fun deleteBySecondEntityId(entityId: Long)
}
