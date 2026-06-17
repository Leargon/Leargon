package org.leargon.backend.domain

class LocalizedText(
    var locale: String = "",
    text: String = ""
) {
    var text: String = text.trimEnd()
        set(value) {
            field = value.trimEnd()
        }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || javaClass != other.javaClass) return false
        val that = other as LocalizedText
        return locale == that.locale && text == that.text
    }

    override fun hashCode(): Int = 31 * locale.hashCode() + text.hashCode()
}
