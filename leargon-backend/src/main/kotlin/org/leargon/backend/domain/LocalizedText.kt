package org.leargon.backend.domain

class LocalizedText(
    var locale: String = "",
    var text: String = ""
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || javaClass != other.javaClass) return false
        val that = other as LocalizedText
        return locale == that.locale
    }

    override fun hashCode(): Int = locale.hashCode()
}
