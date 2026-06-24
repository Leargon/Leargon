package org.leargon.backend.bootstrap

import io.micronaut.context.event.ApplicationEventListener
import io.micronaut.context.event.StartupEvent
import jakarta.inject.Singleton
import org.leargon.backend.service.FieldVerificationBackfillService
import org.slf4j.LoggerFactory

/**
 * Seeds UNVERIFIED field-verification statuses for records created before the verification feature,
 * so existing data shows indicators immediately (the owner then verifies). Idempotent and gated;
 * see [FieldVerificationBackfillService]. Kept in a separate bean so the service's @Transactional
 * methods are invoked through the AOP proxy (not self-invocation).
 */
@Singleton
open class FieldVerificationBackfillBootstrap(
    private val backfillService: FieldVerificationBackfillService
) : ApplicationEventListener<StartupEvent> {
    companion object {
        private val LOG = LoggerFactory.getLogger(FieldVerificationBackfillBootstrap::class.java)
    }

    override fun onApplicationEvent(event: StartupEvent) {
        try {
            backfillService.backfillBusinessEntities()
            backfillService.backfillBusinessDomains()
            backfillService.backfillProcesses()
            backfillService.backfillOrganisationalUnits()
        } catch (e: Exception) {
            LOG.error("Field-verification backfill failed: {}", e.message, e)
        }
    }
}
