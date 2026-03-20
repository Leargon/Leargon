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
open class ClassificationMapper {
    fun toClassificationResponse(classification: Classification): ClassificationResponse =
        ClassificationResponse(
            classification.key,
            ClassificationAssignableTo.fromValue(classification.assignableTo),
            classification.multiValue,
            UserMapper.toUserSummary(classification.createdBy),
            LocalizedTextMapper.toModel(classification.names),
            toClassificationValueResponses(classification.values),
            toZonedDateTime(classification.createdAt),
            toZonedDateTime(classification.updatedAt)
        ).descriptions(LocalizedTextMapper.toModel(classification.descriptions))

    fun toClassificationValueResponses(values: Collection<ClassificationValue>?): List<ClassificationValueResponse> {
        if (values == null) return emptyList()
        return values.map { toClassificationValueResponse(it) }
    }

    fun toClassificationValueResponse(value: ClassificationValue): ClassificationValueResponse =
        ClassificationValueResponse(
            value.key,
            LocalizedTextMapper.toModel(value.names),
            toZonedDateTime(value.createdAt),
            toZonedDateTime(value.updatedAt)
        ).descriptions(LocalizedTextMapper.toModel(value.descriptions))

    companion object {
        @JvmStatic
        fun toClassificationAssignmentResponse(assignment: ClassificationAssignment): ClassificationAssignmentResponse =
            ClassificationAssignmentResponse(assignment.classificationKey, assignment.valueKey)

        @JvmStatic
        fun toClassificationAssignmentResponses(assignments: List<ClassificationAssignment>?): List<ClassificationAssignmentResponse> {
            if (assignments == null) return emptyList()
            return assignments.map { toClassificationAssignmentResponse(it) }
        }

        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)
    }
}
