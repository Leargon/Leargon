package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.Classification
import org.leargon.backend.domain.ClassificationAssignment
import org.leargon.backend.domain.ClassificationValue
import org.leargon.backend.model.ClassificationAssignableTo
import org.leargon.backend.model.ClassificationAssignmentResponse
import org.leargon.backend.model.ClassificationResponse
import org.leargon.backend.model.ClassificationValueResponse

import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime

@Singleton
class ClassificationMapper {

    ClassificationResponse toClassificationResponse(Classification classification) {
        return new ClassificationResponse(
                classification.key,
                ClassificationAssignableTo.fromValue(classification.assignableTo),
                UserMapper.toUserSummary(classification.createdBy),
                LocalizedTextMapper.toModel(classification.names),
                toClassificationValueResponses(classification.values),
                toZonedDateTime(classification.createdAt),
                toZonedDateTime(classification.updatedAt)
        )
                .descriptions(LocalizedTextMapper.toModel(classification.descriptions))
    }

    List<ClassificationValueResponse> toClassificationValueResponses(Collection<ClassificationValue> values) {
        if (values == null) {
            return List.of()
        }
        return values.collect { toClassificationValueResponse(it) }
    }

    ClassificationValueResponse toClassificationValueResponse(ClassificationValue value) {
        return new ClassificationValueResponse(
                value.key,
                LocalizedTextMapper.toModel(value.names),
                toZonedDateTime(value.createdAt),
                toZonedDateTime(value.updatedAt)
        ).descriptions(LocalizedTextMapper.toModel(value.descriptions))
    }

    static ClassificationAssignmentResponse toClassificationAssignmentResponse(ClassificationAssignment assignment) {
        return new ClassificationAssignmentResponse(
                assignment.classificationKey,
                assignment.valueKey
        )
    }

    static List<ClassificationAssignmentResponse> toClassificationAssignmentResponses(List<ClassificationAssignment> assignments) {
        if (assignments == null) {
            return List.of()
        }
        return assignments.collect { toClassificationAssignmentResponse(it) }
    }

    static ZonedDateTime toZonedDateTime(Instant instant) {
        if (instant == null) {
            return null
        }
        return instant.atZone(ZoneOffset.UTC)
    }
}
