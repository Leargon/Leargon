package org.leargon.backend.domain

/**
 * The one place that decides which entry of a [LocalizedText] list to show.
 *
 * Every domain class used to repeat `names.find { it.locale == locale }?.text ?: names.first().text`,
 * which had two problems: `first()` throws on an empty list, and it happily returns a blank entry that
 * a translator started and never filled in. Both showed up as an empty or crashing label rather than a
 * usable fallback.
 *
 * The chain is: requested locale → any other locale that actually has text → the caller's last resort
 * (normally the item key). The caller supplies the tenant default locale as [locale] when it is
 * flattening for storage-free display, so "fall back to the default locale" is covered by the first rung.
 */
fun List<LocalizedText>.textForLocale(
    locale: String,
    fallback: String
): String =
    firstOrNull { it.locale == locale && it.text.isNotBlank() }?.text
        ?: firstOrNull { it.text.isNotBlank() }?.text
        ?: fallback
