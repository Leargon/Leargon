package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * How a catalogue item came into being: who created it, under which grant ([basis]), in which container
 * ([realmType]/[realmId]) and — for a justified duplicate — why. The owner of the container reviews items
 * created there by others; the acknowledgement ([reviewedAt]) lives here, so it survives later edits.
 *
 * Every reference is a plain id rather than an association: the record outlives the user or item it
 * points at, and the review is resolved against live data when the to-do list is derived.
 */
@Entity
@Table(name = "item_creation_records")
class ItemCreationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "resource_type", nullable = false, length = 30)
    var resourceType: String = ""

    @Column(name = "resource_id", nullable = false)
    var resourceId: Long = 0

    @Column(name = "realm_type", length = 30)
    var realmType: String? = null

    @Column(name = "realm_id")
    var realmId: Long? = null

    @Column(name = "created_by_id")
    var createdById: Long? = null

    @Column(name = "basis", length = 30)
    var basis: String? = null

    /** JSON list of `{locale, text}` — kept as text so reads never trigger JSON dirty-checking updates. */
    @Column(name = "duplicate_justification", columnDefinition = "LONGTEXT")
    var duplicateJustification: String? = null

    /** Newline-separated keys of the blocking duplicate candidates the creator acknowledged. */
    @Column(name = "acknowledged_candidate_keys", columnDefinition = "LONGTEXT")
    var acknowledgedCandidateKeys: String? = null

    @Column(name = "reviewed_by_id")
    var reviewedById: Long? = null

    @Column(name = "reviewed_at")
    var reviewedAt: Instant? = null

    @DateCreated
    @Column(name = "created_at", nullable = false)
    var createdAt: Instant? = null
}
