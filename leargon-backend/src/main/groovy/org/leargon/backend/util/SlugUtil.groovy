package org.leargon.backend.util

import java.text.Normalizer

class SlugUtil {

    static String slugify(String text) {
        if (text == null || text.trim().isEmpty()) {
            return ''
        }
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll('\\p{InCombiningDiacriticalMarks}+', '')
        return normalized
                .toLowerCase()
                .replaceAll('[\\s_]+', '-')
                .replaceAll('[^a-z0-9-]', '')
                .replaceAll('-{2,}', '-')
                .replaceAll('^-|-$', '')
    }

    static String buildKey(String parentKey, String slug) {
        return parentKey ? "${parentKey}.${slug}" : slug
    }
}
