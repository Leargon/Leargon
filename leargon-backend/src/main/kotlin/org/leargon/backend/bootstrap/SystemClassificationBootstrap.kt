package org.leargon.backend.bootstrap

import io.micronaut.context.event.ApplicationEventListener
import io.micronaut.context.event.StartupEvent
import io.micronaut.core.annotation.Order
import jakarta.inject.Singleton
import jakarta.transaction.Transactional
import org.leargon.backend.domain.Classification
import org.leargon.backend.domain.ClassificationValue
import org.leargon.backend.domain.LocalizedText
import org.leargon.backend.domain.User
import org.leargon.backend.repository.ClassificationRepository
import org.leargon.backend.repository.UserRepository
import org.slf4j.LoggerFactory
import java.time.Instant

/**
 * Ensures DSG/GDPR system classifications exist and are up to date on every startup.
 *
 * Runs after [AdministratorUserBootstrap] (order = 10 vs default 0).
 * If the fallback admin is not yet available (e.g. first-ever cold start with no
 * env vars set), classifications are still created with a null createdBy and the
 * field is patched on the next startup once the admin exists.
 *
 * Liquibase migration 038 also inserts these rows, but it runs before the admin
 * is created, so the INSERTs may fail on a fresh DB.  This bootstrap is the
 * authoritative, idempotent source of truth.
 */
@Singleton
@Order(10)
open class SystemClassificationBootstrap(
    private val classificationRepository: ClassificationRepository,
    private val userRepository: UserRepository,
) : ApplicationEventListener<StartupEvent> {
    companion object {
        private val LOG = LoggerFactory.getLogger(SystemClassificationBootstrap::class.java)

        private data class ValueSeed(
            val key: String,
            val names: List<LocalizedText>,
        )

        private data class ClassificationSeed(
            val key: String,
            val names: List<LocalizedText>,
            val descriptions: List<LocalizedText>,
            val assignableTo: String,
            val multiValue: Boolean,
            val values: List<ValueSeed>,
        )

        private val SYSTEM_CLASSIFICATIONS =
            listOf(
                ClassificationSeed(
                    key = "personal-data",
                    names =
                        listOf(
                            LocalizedText("en", "Personal Data"),
                            LocalizedText("de", "Personenbezogene Daten"),
                            LocalizedText("fr", "Données Personnelles"),
                        ),
                    descriptions =
                        listOf(
                            LocalizedText("en", "Indicates whether this entity contains personal data as defined by DSG/GDPR Art. 4."),
                        ),
                    assignableTo = "BUSINESS_ENTITY",
                    multiValue = false,
                    values =
                        listOf(
                            ValueSeed(
                                key = "personal-data--contains",
                                names =
                                    listOf(
                                        LocalizedText("en", "Contains Personal Data"),
                                        LocalizedText("de", "Enthält personenbezogene Daten"),
                                        LocalizedText("fr", "Contient des données personnelles"),
                                    ),
                            ),
                            ValueSeed(
                                key = "personal-data--not-contains",
                                names =
                                    listOf(
                                        LocalizedText("en", "Does Not Contain Personal Data"),
                                        LocalizedText("de", "Enthält keine personenbezogenen Daten"),
                                        LocalizedText("fr", "Ne contient pas de données personnelles"),
                                    ),
                            ),
                        ),
                ),
                ClassificationSeed(
                    key = "special-categories",
                    names =
                        listOf(
                            LocalizedText("en", "Special Categories (Art. 9 GDPR)"),
                            LocalizedText("de", "Besondere Kategorien (Art. 9 DSGVO)"),
                            LocalizedText("fr", "Catégories Spéciales (Art. 9 RGPD)"),
                        ),
                    descriptions =
                        listOf(
                            LocalizedText(
                                "en",
                                "Special categories of personal data as defined by Art. 9 GDPR / DSG requiring heightened protection."
                            ),
                        ),
                    assignableTo = "BUSINESS_ENTITY",
                    multiValue = true,
                    values =
                        listOf(
                            ValueSeed(
                                "special-categories--health",
                                listOf(
                                    LocalizedText("en", "Health Data"),
                                    LocalizedText("de", "Gesundheitsdaten"),
                                    LocalizedText("fr", "Données de santé")
                                )
                            ),
                            ValueSeed(
                                "special-categories--biometric",
                                listOf(
                                    LocalizedText("en", "Biometric Data"),
                                    LocalizedText("de", "Biometrische Daten"),
                                    LocalizedText("fr", "Données biométriques")
                                )
                            ),
                            ValueSeed(
                                "special-categories--genetic",
                                listOf(
                                    LocalizedText("en", "Genetic Data"),
                                    LocalizedText("de", "Genetische Daten"),
                                    LocalizedText("fr", "Données génétiques")
                                )
                            ),
                            ValueSeed(
                                "special-categories--political",
                                listOf(
                                    LocalizedText("en", "Political Opinion"),
                                    LocalizedText("de", "Politische Meinung"),
                                    LocalizedText("fr", "Opinion politique")
                                )
                            ),
                            ValueSeed(
                                "special-categories--religious",
                                listOf(
                                    LocalizedText("en", "Religious Belief"),
                                    LocalizedText("de", "Religiöse Überzeugung"),
                                    LocalizedText("fr", "Conviction religieuse")
                                )
                            ),
                            ValueSeed(
                                "special-categories--trade-union",
                                listOf(
                                    LocalizedText("en", "Trade Union Membership"),
                                    LocalizedText("de", "Gewerkschaftszugehörigkeit"),
                                    LocalizedText("fr", "Appartenance syndicale")
                                )
                            ),
                            ValueSeed(
                                "special-categories--ethnic",
                                listOf(
                                    LocalizedText("en", "Racial or Ethnic Origin"),
                                    LocalizedText("de", "Rassische oder ethnische Herkunft"),
                                    LocalizedText("fr", "Origine raciale ou ethnique")
                                )
                            ),
                            ValueSeed(
                                "special-categories--sexual",
                                listOf(
                                    LocalizedText("en", "Sexual Orientation"),
                                    LocalizedText("de", "Sexuelle Orientierung"),
                                    LocalizedText("fr", "Orientation sexuelle")
                                )
                            ),
                            ValueSeed(
                                "special-categories--criminal",
                                listOf(
                                    LocalizedText("en", "Criminal Convictions"),
                                    LocalizedText("de", "Strafrechtliche Verurteilungen"),
                                    LocalizedText("fr", "Condamnations pénales")
                                )
                            ),
                            ValueSeed(
                                "special-categories--none",
                                listOf(LocalizedText("en", "None"), LocalizedText("de", "Keine"), LocalizedText("fr", "Aucune"))
                            ),
                        ),
                ),
            )
    }

    @Transactional
    override fun onApplicationEvent(event: StartupEvent?) {
        val admin: User? = userRepository.findByIsFallbackAdministrator(true).orElse(null)
        if (admin == null) {
            LOG.warn(
                "SystemClassificationBootstrap: fallback admin not found — classifications will be created without an owner and patched on next startup"
            )
        }

        for (seed in SYSTEM_CLASSIFICATIONS) {
            val existing = classificationRepository.findByKey(seed.key).orElse(null)

            if (existing == null) {
                val classification =
                    Classification().apply {
                        key = seed.key
                        names = seed.names.toMutableList()
                        descriptions = seed.descriptions.toMutableList()
                        assignableTo = seed.assignableTo
                        multiValue = seed.multiValue
                        isSystem = true
                        createdBy = admin
                        createdAt = Instant.now()
                        updatedAt = Instant.now()
                    }
                seed.values.forEach { v ->
                    classification.addValue(
                        ClassificationValue().apply {
                            key = v.key
                            names = v.names.toMutableList()
                            descriptions = mutableListOf()
                            createdBy = admin
                            createdAt = Instant.now()
                            updatedAt = Instant.now()
                        },
                    )
                }
                classificationRepository.save(classification)
                LOG.info("SystemClassificationBootstrap: created system classification '{}'", seed.key)
            } else {
                var changed = false

                // Always mark as system
                if (!existing.isSystem) {
                    existing.isSystem = true
                    changed = true
                }

                // Patch null createdBy once admin is available
                if (existing.createdBy == null && admin != null) {
                    existing.createdBy = admin
                    changed = true
                }

                // Keep names/descriptions in sync with the seed
                if (existing.names != seed.names) {
                    existing.names = seed.names.toMutableList()
                    changed = true
                }
                if (existing.descriptions != seed.descriptions) {
                    existing.descriptions = seed.descriptions.toMutableList()
                    changed = true
                }

                // Ensure all seeded values exist (add missing ones; don't remove extras)
                val existingValueKeys = existing.values.map { it.key }.toSet()
                seed.values.filter { it.key !in existingValueKeys }.forEach { v ->
                    existing.addValue(
                        ClassificationValue().apply {
                            key = v.key
                            names = v.names.toMutableList()
                            descriptions = mutableListOf()
                            createdBy = admin
                            createdAt = Instant.now()
                            updatedAt = Instant.now()
                        },
                    )
                    changed = true
                }

                if (changed) {
                    existing.updatedAt = Instant.now()
                    classificationRepository.update(existing)
                    LOG.info("SystemClassificationBootstrap: updated system classification '{}'", seed.key)
                }
            }
        }
    }
}
