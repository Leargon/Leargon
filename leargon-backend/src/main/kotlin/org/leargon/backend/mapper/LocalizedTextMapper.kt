package org.leargon.backend.mapper

import jakarta.inject.Singleton

@Singleton
open class LocalizedTextMapper {

    companion object {
        @JvmStatic
        fun toModel(localizedText: org.leargon.backend.domain.LocalizedText): org.leargon.backend.model.LocalizedText {
            return org.leargon.backend.model.LocalizedText(localizedText.locale, localizedText.text)
        }

        @JvmStatic
        fun toModel(localizedTexts: List<org.leargon.backend.domain.LocalizedText>?): List<org.leargon.backend.model.LocalizedText> {
            if (localizedTexts == null) return emptyList()
            return localizedTexts.map { toModel(it) }
        }
    }
}
