package org.leargon.backend.exception

import org.leargon.backend.model.DuplicateCandidate

/**
 * Creation would add a likely duplicate and the request neither justified it nor acknowledged every
 * blocking candidate. Mapped to 409 with the candidates so the UI can offer reuse / translation links.
 */
class DuplicateCandidatesException(
    val candidates: List<DuplicateCandidate>
) : RuntimeException("Likely duplicates exist: ${candidates.filter { it.blocking }.joinToString { it.key }}")
