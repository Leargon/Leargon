package org.leargon.backend.util

import java.text.Normalizer

/**
 * Deterministic name matching for duplicate detection. Names are normalised (compatibility decomposition,
 * diacritics stripped, `ß` → `ss`, lower-case, punctuation → space) so "Müller-Daten" / "Mueller Daten"
 * and "Straße" / "Strasse" are recognised. Numbers are significant: "Invoice 2023" is not a duplicate of
 * "Invoice 2024".
 */
object NameMatching {
    enum class MatchType { EXACT, SIMILAR }

    data class Match(
        val type: MatchType,
        val score: Double
    )

    /** Words this short must be identical — "Plant A" and "Plant B" are different things, not a typo. */
    private const val EXACT_WORD_LENGTH = 3

    fun normalize(text: String): String {
        val decomposed =
            Normalizer
                .normalize(text.replace("ß", "ss").replace("ẞ", "SS"), Normalizer.Form.NFKD)
                .replace(Regex("\\p{M}+"), "")
        // "RiskManagementContext" is three words, not one — otherwise long camel-case names look like typos
        // of each other ("PolicyManagementContext").
        return decomposed
            .replace(Regex("(?<=[\\p{Ll}\\p{N}])(?=\\p{Lu})|(?<=\\p{Lu})(?=\\p{Lu}\\p{Ll})"), " ")
            .lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .trim()
            .replace(Regex("\\s+"), " ")
    }

    fun match(
        a: String,
        b: String
    ): Match? {
        val na = normalize(a)
        val nb = normalize(b)
        if (na.isEmpty() || nb.isEmpty()) return null
        // "CustomerOrder" and "Customer Order" are the same name written differently.
        if (na == nb || na.replace(" ", "") == nb.replace(" ", "")) return Match(MatchType.EXACT, 1.0)
        if (numbers(na) != numbers(nb)) return null
        if (!wordsAlign(na.split(' '), nb.split(' '))) return null
        val ratio = 1.0 - distance(na, nb).toDouble() / maxOf(na.length, nb.length)
        return Match(MatchType.SIMILAR, ratio)
    }

    /** The strongest match between any proposed name and any existing name (all locales against all). */
    fun bestMatch(
        proposed: Collection<String>,
        existing: Collection<String>
    ): Match? = proposed.flatMap { p -> existing.mapNotNull { match(p, it) } }.maxByOrNull { it.score }

    private fun numbers(normalized: String): List<String> =
        Regex("\\d+").findAll(normalized).map { it.value.trimStart('0').ifEmpty { "0" } }.toList().sorted()

    /**
     * Two names are similar only when their words pair up one-to-one (in any order) with each pair being
     * the same word up to a typo: short words must be identical, longer ones may differ by about one edit
     * per four characters. A replaced word ("Team North" / "Team South") is a different name, not a typo.
     */
    private fun wordsAlign(
        wordsA: List<String>,
        wordsB: List<String>
    ): Boolean {
        if (wordsA.size != wordsB.size) return false
        val remaining = wordsB.toMutableList()
        for (word in wordsA) {
            val partner = remaining.firstOrNull { wordsClose(word, it) } ?: return false
            remaining.remove(partner)
        }
        return true
    }

    private fun wordsClose(
        a: String,
        b: String
    ): Boolean {
        if (a == b) return true
        if (minOf(a.length, b.length) <= EXACT_WORD_LENGTH) return false
        return distance(a, b) <= maxOf(1, minOf(a.length, b.length) / 4)
    }

    /** Optimal-string-alignment (Damerau–Levenshtein with adjacent transpositions) distance. */
    private fun distance(
        a: String,
        b: String
    ): Int {
        val d = Array(a.length + 1) { IntArray(b.length + 1) }
        for (i in 0..a.length) d[i][0] = i
        for (j in 0..b.length) d[0][j] = j
        for (i in 1..a.length) {
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                d[i][j] = minOf(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) {
                    d[i][j] = minOf(d[i][j], d[i - 2][j - 2] + 1)
                }
            }
        }
        return d[a.length][b.length]
    }
}
