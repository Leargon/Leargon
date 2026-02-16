package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.SupportedLocale

@Repository
interface SupportedLocaleRepository extends JpaRepository<SupportedLocale, Long> {

    Optional<SupportedLocale> findByLocaleCode(String localeCode)

    List<SupportedLocale> findByIsActiveOrderBySortOrder(boolean isActive)

    Optional<SupportedLocale> findByIsDefault(boolean isDefault)

    List<SupportedLocale> findAllOrderBySortOrder()

    boolean existsByLocaleCode(String localeCode)
}
