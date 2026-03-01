package org.leargon.backend.repository

import groovy.transform.CompileStatic
import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.SupportedLocale

@CompileStatic
@Repository
interface SupportedLocaleRepository extends JpaRepository<SupportedLocale, Long> {

    Optional<SupportedLocale> findByLocaleCode(String localeCode)

    List<SupportedLocale> findByIsActiveOrderBySortOrder(boolean isActive)

    Optional<SupportedLocale> findByIsDefault(boolean isDefault)

    List<SupportedLocale> findAllOrderBySortOrder()

    boolean existsByLocaleCode(String localeCode)
}
