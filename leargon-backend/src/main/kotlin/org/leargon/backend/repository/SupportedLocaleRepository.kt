package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.SupportedLocale
import java.util.Optional

@Repository
interface SupportedLocaleRepository : JpaRepository<SupportedLocale, Long> {

    fun findByLocaleCode(localeCode: String): Optional<SupportedLocale>

    fun findByIsActiveOrderBySortOrder(isActive: Boolean): List<SupportedLocale>

    fun findByIsDefault(isDefault: Boolean): Optional<SupportedLocale>

    fun findAllOrderBySortOrder(): List<SupportedLocale>

    fun existsByLocaleCode(localeCode: String): Boolean
}
