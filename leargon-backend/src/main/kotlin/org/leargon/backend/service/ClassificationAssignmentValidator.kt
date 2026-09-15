package org.leargon.backend.service

import jakarta.inject.Singleton
import org.leargon.backend.domain.ClassificationAssignment
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.ClassificationAssignmentRequest
import org.leargon.backend.repository.ClassificationRepository

/**
 * Validates classification assignments (classification exists, is assignable to the item type, respects
 * single-value, value exists). Standalone so the create paths (which run before any assignment endpoint)
 * and [ClassificationService] share one set of rules without a service dependency cycle.
 */
@Singleton
class ClassificationAssignmentValidator(
    private val classificationRepository: ClassificationRepository
) {
    fun validate(
        assignments: List<ClassificationAssignmentRequest>,
        expectedAssignableTo: String
    ) {
        assignments.groupBy { it.classificationKey }.forEach { (classKey, group) ->
            val classification =
                classificationRepository
                    .findByKey(classKey)
                    .orElseThrow { ResourceNotFoundException("Classification not found: $classKey") }

            if (classification.assignableTo != expectedAssignableTo) {
                throw IllegalArgumentException(
                    "Classification '$classKey' is not assignable to $expectedAssignableTo"
                )
            }

            if (group.size > 1 && !classification.multiValue) {
                throw IllegalArgumentException(
                    "Classification '$classKey' is single-value: only one value can be assigned"
                )
            }

            group.forEach { assignment ->
                if (classification.values.none { it.key == assignment.valueKey }) {
                    throw ResourceNotFoundException(
                        "Classification value '${assignment.valueKey}' not found in classification '$classKey'"
                    )
                }
            }
        }
    }

    /** Validates and converts to the embedded domain representation. */
    fun toAssignments(
        assignments: List<ClassificationAssignmentRequest>,
        expectedAssignableTo: String
    ): MutableList<ClassificationAssignment> {
        validate(assignments, expectedAssignableTo)
        return assignments.map { ClassificationAssignment(it.classificationKey, it.valueKey) }.toMutableList()
    }
}
