package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.repository.SupportedLocaleRepository

/**
 * The tenant's default locale, for the mappers that have to flatten a [org.leargon.backend.domain.LocalizedText]
 * list down to one string.
 *
 * The mappers used to hardcode `"en"` here, which is why a German tenant saw English names on every
 * summary DTO. The locale a *reader* wants is answered by the `names` arrays those DTOs now carry;
 * this provider only answers the different question of which single locale to put in the plain
 * `name` fallback field, and the honest answer is whichever locale the tenant configured as default.
 *
 * Deliberately depends on the locale repository alone rather than on [LocaleService], whose
 * constructor pulls in a dozen repositories that a mapper has no business dragging along.
 */
@Singleton
open class DefaultLocaleProvider(
    private val localeRepository: SupportedLocaleRepository
) {
    /**
     * The default locale code, falling back to [FALLBACK] when no locale is flagged as default —
     * which happens in tests and during the very first startup, before the locale seed has run.
     */
    open fun code(): String =
        localeRepository
            .findByIsDefault(true)
            .map { it.localeCode }
            .orElse(FALLBACK)

    companion object {
        const val FALLBACK: String = "en"
    }
}
