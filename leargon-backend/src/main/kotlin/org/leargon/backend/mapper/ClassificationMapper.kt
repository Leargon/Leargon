package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.BusinessEntity
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
            classification.isSystem,
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
        fun computeEffectiveAssignments(
            ownAssignments: List<ClassificationAssignment>,
            interfaceEntities: Collection<BusinessEntity>
        ): List<ClassificationAssignmentResponse> {
            val result = mutableListOf<ClassificationAssignmentResponse>()
            val coveredKeys = mutableSetOf<String>()

            for (a in ownAssignments) {
                result += ClassificationAssignmentResponse(a.classificationKey, a.valueKey).inherited(false)
                coveredKeys += a.classificationKey
            }

            // Collect candidate inherited values; null means conflicting interfaces disagree
            val inheritedValues = mutableMapOf<String, String?>()
            val inheritedSources = mutableMapOf<String, String>()

            for (iface in interfaceEntities) {
                for (a in iface.classificationAssignments) {
                    if (a.classificationKey in coveredKeys) continue
                    when {
                        !inheritedValues.containsKey(a.classificationKey) -> {
                            inheritedValues[a.classificationKey] = a.valueKey
                            inheritedSources[a.classificationKey] = iface.key
                        }

                        inheritedValues[a.classificationKey] != null &&
                            inheritedValues[a.classificationKey] != a.valueKey -> {
                            // Two interfaces disagree — disable inheritance for this key
                            inheritedValues[a.classificationKey] = null
                            inheritedSources.remove(a.classificationKey)
                        }
                        // Same value from another interface — no action needed
                    }
                }
            }

            for ((classKey, valueKey) in inheritedValues) {
                if (valueKey != null) {
                    result +=
                        ClassificationAssignmentResponse(classKey, valueKey)
                            .inherited(true)
                            .inheritedFromEntityKey(inheritedSources[classKey])
                }
            }

            return result
        }

        @JvmStatic
        fun toZonedDateTime(instant: Instant?): ZonedDateTime? = instant?.atZone(ZoneOffset.UTC)
    }
}
