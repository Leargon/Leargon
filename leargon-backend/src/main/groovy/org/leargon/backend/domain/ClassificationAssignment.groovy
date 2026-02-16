package org.leargon.backend.domain

import io.micronaut.serde.annotation.Serdeable

@Serdeable
class ClassificationAssignment {

    String classificationKey
    String valueKey

    ClassificationAssignment() {
    }

    ClassificationAssignment(String classificationKey, String valueKey) {
        this.classificationKey = classificationKey
        this.valueKey = valueKey
    }
}
