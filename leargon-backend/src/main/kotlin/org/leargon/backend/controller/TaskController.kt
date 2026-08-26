package org.leargon.backend.controller

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.security.annotation.Secured
import io.micronaut.security.rules.SecurityRule
import io.micronaut.security.utils.SecurityService
import jakarta.validation.Valid
import org.leargon.backend.api.TaskApi
import org.leargon.backend.exception.ResourceNotFoundException
import org.leargon.backend.model.DismissTaskRequest
import org.leargon.backend.model.OwnerTaskLoadResponse
import org.leargon.backend.model.TaskItem
import org.leargon.backend.model.TaskListResponse
import org.leargon.backend.service.TaskService

@Controller
@Secured(SecurityRule.IS_AUTHENTICATED)
open class TaskController(
    private val taskService: TaskService,
    private val securityService: SecurityService
) : TaskApi {
    override fun getMyTasks(includeDismissed: Boolean?): TaskListResponse = taskService.getMyTasks(currentEmail(), includeDismissed == true)

    @Secured("ROLE_ADMIN")
    override fun getTasksByOwner(): OwnerTaskLoadResponse = taskService.getTasksByOwner()

    override fun dismissTask(
        taskId: String,
        @Body @Valid dismissTaskRequest: DismissTaskRequest
    ): TaskItem = taskService.dismiss(currentEmail(), taskId, dismissTaskRequest.reason)

    override fun undismissTask(taskId: String): HttpResponse<Void> {
        taskService.undismiss(currentEmail(), taskId)
        return HttpResponse.noContent()
    }

    private fun currentEmail(): String =
        securityService
            .username()
            .orElseThrow { ResourceNotFoundException("User not authenticated") }
}
