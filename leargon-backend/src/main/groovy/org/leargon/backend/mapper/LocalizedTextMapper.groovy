package org.leargon.backend.mapper

import jakarta.inject.Singleton

@Singleton
class LocalizedTextMapper {

    static org.leargon.backend.model.LocalizedText toModel(org.leargon.backend.domain.LocalizedText localizedText) {
        return new org.leargon.backend.model.LocalizedText(localizedText.locale, localizedText.text)
    }

    static List<org.leargon.backend.model.LocalizedText> toModel(List<org.leargon.backend.domain.LocalizedText> localizedTexts) {
        if (localizedTexts == null) {
            return List.of()
        }
        return localizedTexts.collect { toModel(it) }
    }
}
