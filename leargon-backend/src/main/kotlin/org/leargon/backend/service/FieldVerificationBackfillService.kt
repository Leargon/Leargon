package org.leargon.backend.service

import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.repository.BusinessDomainRepository
import org.leargon.backend.repository.BusinessEntityRepository
import org.leargon.backend.repository.FieldVerificationRepository
import org.leargon.backend.repository.OrganisationalUnitRepository
import org.leargon.backend.repository.ProcessRepository
import org.leargon.backend.service.fieldvalue.BusinessDomainFieldValueExtractor
import org.leargon.backend.service.fieldvalue.BusinessEntityFieldValueExtractor
import org.leargon.backend.service.fieldvalue.OrganisationalUnitFieldValueExtractor
import org.leargon.backend.service.fieldvalue.ProcessFieldValueExtractor
import org.slf4j.LoggerFactory

/**
 * One-time backfill of UNVERIFIED field statuses for records that predate the verification feature.
 * Reuses the per-type [org.leargon.backend.service.fieldvalue.FieldValueExtractor]s and
 * [FieldConfigurationService] so the seeded values match exactly what the live feature would produce.
 *
 * Idempotent and gated: each type is skipped once every record already has verification rows, so
 * steady-state startup cost is two count/id queries per type.
 */
@Singleton
open class FieldVerificationBackfillService(
    private val fieldVerificationService: FieldVerificationService,
    private val fieldVerificationRepository: FieldVerificationRepository,
    private val businessEntityRepository: BusinessEntityRepository,
    private val businessDomainRepository: BusinessDomainRepository,
    private val processRepository: ProcessRepository,
    private val organisationalUnitRepository: OrganisationalUnitRepository,
    private val businessEntityFieldValueExtractor: BusinessEntityFieldValueExtractor,
    private val businessDomainFieldValueExtractor: BusinessDomainFieldValueExtractor,
    private val processFieldValueExtractor: ProcessFieldValueExtractor,
    private val organisationalUnitFieldValueExtractor: OrganisationalUnitFieldValueExtractor
) {
    companion object {
        private val LOG = LoggerFactory.getLogger(FieldVerificationBackfillService::class.java)
    }

    @Transactional
    open fun backfillBusinessEntities() {
        val total = businessEntityRepository.count()
        if (total == 0L) return
        val covered = fieldVerificationRepository.findDistinctEntityIdByEntityType("BUSINESS_ENTITY").toSet()
        if (covered.size.toLong() >= total) return
        val ext = this.businessEntityFieldValueExtractor
        val fvs = this.fieldVerificationService
        var count = 0
        businessEntityRepository.findAll().forEach { e ->
            val id = e.id ?: return@forEach
            if (id in covered) return@forEach
            fvs.backfillUnverified("BUSINESS_ENTITY", id) { fn -> ext.value(e, fn) }
            count++
        }
        if (count > 0) LOG.info("Field-verification backfill: seeded {} business entit(ies)", count)
    }

    @Transactional
    open fun backfillBusinessDomains() {
        val total = businessDomainRepository.count()
        if (total == 0L) return
        val covered = fieldVerificationRepository.findDistinctEntityIdByEntityType("BUSINESS_DOMAIN").toSet()
        if (covered.size.toLong() >= total) return
        val ext = this.businessDomainFieldValueExtractor
        val fvs = this.fieldVerificationService
        var count = 0
        businessDomainRepository.findAll().forEach { e ->
            val id = e.id ?: return@forEach
            if (id in covered) return@forEach
            fvs.backfillUnverified("BUSINESS_DOMAIN", id) { fn -> ext.value(e, fn) }
            count++
        }
        if (count > 0) LOG.info("Field-verification backfill: seeded {} business domain(s)", count)
    }

    @Transactional
    open fun backfillProcesses() {
        val total = processRepository.count()
        if (total == 0L) return
        val covered = fieldVerificationRepository.findDistinctEntityIdByEntityType("BUSINESS_PROCESS").toSet()
        if (covered.size.toLong() >= total) return
        val ext = this.processFieldValueExtractor
        val fvs = this.fieldVerificationService
        var count = 0
        processRepository.findAll().forEach { e ->
            val id = e.id ?: return@forEach
            if (id in covered) return@forEach
            fvs.backfillUnverified("BUSINESS_PROCESS", id) { fn -> ext.value(e, fn) }
            count++
        }
        if (count > 0) LOG.info("Field-verification backfill: seeded {} process(es)", count)
    }

    @Transactional
    open fun backfillOrganisationalUnits() {
        val total = organisationalUnitRepository.count()
        if (total == 0L) return
        val covered = fieldVerificationRepository.findDistinctEntityIdByEntityType("ORGANISATIONAL_UNIT").toSet()
        if (covered.size.toLong() >= total) return
        val ext = this.organisationalUnitFieldValueExtractor
        val fvs = this.fieldVerificationService
        var count = 0
        organisationalUnitRepository.findAll().forEach { e ->
            val id = e.id ?: return@forEach
            if (id in covered) return@forEach
            fvs.backfillUnverified("ORGANISATIONAL_UNIT", id) { fn -> ext.value(e, fn) }
            count++
        }
        if (count > 0) LOG.info("Field-verification backfill: seeded {} organisational unit(s)", count)
    }
}
