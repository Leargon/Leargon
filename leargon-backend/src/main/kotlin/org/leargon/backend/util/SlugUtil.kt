package org.leargon.backend.util

import java.text.Normalizer

object SlugUtil {
    fun slugify(text: String?): String {
        if (text == null || text.trim().isEmpty()) {
            return ""
        }
        val normalized =
            Normalizer
                .normalize(text, Normalizer.Form.NFD)
                .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
        return normalized
            .lowercase()
            .replace(Regex("[\\s_]+"), "-")
            .replace(Regex("[^a-z0-9-]"), "")
            .replace(Regex("-{2,}"), "-")
            .replace(Regex("^-|-$"), "")
    }

    fun buildKey(
        parentKey: String?,
        slug: String
    ): String = if (!parentKey.isNullOrEmpty()) "$parentKey.$slug" else slug
}
