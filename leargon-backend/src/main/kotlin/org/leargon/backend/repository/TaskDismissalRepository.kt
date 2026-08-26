package org.leargon.backend.repository

import io.micronaut.data.annotation.Repository
import io.micronaut.data.jpa.repository.JpaRepository
import org.leargon.backend.domain.TaskDismissal
import java.util.Optional

@Repository
interface TaskDismissalRepository : JpaRepository<TaskDismissal, Long> {
    fun findByUserId(userId: Long): List<TaskDismissal>

    fun findByUserIdAndTaskId(
        userId: Long,
        taskId: String
    ): Optional<TaskDismissal>

    fun deleteByUserIdAndTaskId(
        userId: Long,
        taskId: String
    )
}
