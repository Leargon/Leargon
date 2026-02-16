package org.leargon.backend.domain

import io.micronaut.serde.annotation.Serdeable

@Serdeable
class LocalizedText {

    String locale
    String text

    LocalizedText() {
    }

    LocalizedText(String locale, String text) {
        this.locale = locale
        this.text = text
    }

    @Override
    boolean equals(Object o) {
        if (this.is(o)) return true
        if (o == null || getClass() != o.getClass()) return false
        LocalizedText that = (LocalizedText) o
        return Objects.equals(locale, that.locale)
    }

    @Override
    int hashCode() {
        return Objects.hash(locale)
    }
}
