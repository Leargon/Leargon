package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import jakarta.persistence.Column
import jakarta.persistence.ConstraintMode
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.ForeignKey
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

/**
 * A user's decision that a derived governance to-do does not apply to their item.
 *
 * Tasks themselves are never stored — they are re-derived on every read — so a dismissal is keyed by
 * the deterministic task id. [itemUpdatedAt] snapshots the catalogue item's `updatedAt` at dismissal
 * time: once the item changes, the dismissal is ignored and the task resurfaces, so a stale
 * dismissal can never hide a regression.
 */
@Entity
@Table(
    name = "task_dismissals",
    uniqueConstraints = [
        UniqueConstraint(name = "uq_task_dismissal_task_user", columnNames = ["task_id", "user_id"])
    ]
)
class TaskDismissal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "task_id", nullable = false, length = 255)
    var taskId: String = ""

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = ForeignKey(ConstraintMode.NO_CONSTRAINT))
    var user: User? = null

    @Column(name = "reason", nullable = false, length = 500)
    var reason: String = ""

    /** The item's `updatedAt` when the task was dismissed; a later value revives the task. */
    @Column(name = "item_updated_at")
    var itemUpdatedAt: Instant? = null

    @DateCreated
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant? = null
}
