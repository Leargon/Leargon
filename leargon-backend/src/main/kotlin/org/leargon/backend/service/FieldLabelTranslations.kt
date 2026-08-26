package org.leargon.backend.service

/**
 * Translations of the static field-inventory labels.
 *
 * The inventory in [FieldConfigurationService] carries one English label per field; the words it uses
 * are the platform's own vocabulary ("Data Owner", "Bounded Context"), so translating them is a fixed,
 * closed set rather than user content — hence a table here instead of a database of localised labels.
 * Wording follows the frontend's existing German and French vocabulary so a field is called the same
 * thing on the to-do list as on the detail panel.
 *
 * Keys are the English label. A locale with no entry, or a label the table does not cover, falls back
 * to English rather than showing a key.
 */
object FieldLabelTranslations {
    private val byLabel: Map<String, Map<String, String>> =
        mapOf(
            // ── inventory fields ─────────────────────────────────────────────
            "Activity Justification" to mapOf("de" to "Begründung der Tätigkeit", "fr" to "Justification de l'activité"),
            "Activity Type" to mapOf("de" to "Tätigkeitstyp", "fr" to "Type d'activité"),
            "Bounded Context" to mapOf("de" to "Begrenzter Kontext", "fr" to "Contexte délimité"),
            "Bounded Contexts" to mapOf("de" to "Begrenzte Kontexte", "fr" to "Contextes délimités"),
            "Business Owner" to mapOf("de" to "Fachverantwortlicher", "fr" to "Responsable métier"),
            "Business Steward" to mapOf("de" to "Fachlicher Steward", "fr" to "Gestionnaire métier"),
            "Called Sub-Processes" to mapOf("de" to "Aufgerufene Teilprozesse", "fr" to "Sous-processus appelés"),
            "Capabilities" to mapOf("de" to "Fähigkeiten", "fr" to "Capacités"),
            "Changeover Time (min)" to mapOf("de" to "Rüstzeit (Min.)", "fr" to "Temps de changement (min)"),
            "Classification" to mapOf("de" to "Klassifizierung", "fr" to "Classification"),
            "Completion Rate (%)" to mapOf("de" to "Abschlussquote (%)", "fr" to "Taux d'achèvement (%)"),
            "Context Relationships" to mapOf("de" to "Kontextbeziehungen", "fr" to "Relations entre contextes"),
            "Country of Execution" to mapOf("de" to "Ausführungsland", "fr" to "Pays d'exécution"),
            "Cross-Border Transfers" to mapOf("de" to "Grenzüberschreitende Übermittlungen", "fr" to "Transferts transfrontaliers"),
            "Cycle Time (min)" to mapOf("de" to "Durchlaufzeit (Min.)", "fr" to "Temps de cycle (min)"),
            "Data Access (Read)" to mapOf("de" to "Datenzugriff (Lesen)", "fr" to "Accès aux données (lecture)"),
            "Data Manipulation (Write)" to mapOf("de" to "Datenbearbeitung (Schreiben)", "fr" to "Manipulation des données (écriture)"),
            "Data Owner" to mapOf("de" to "Dateneigentümer", "fr" to "Propriétaire des données"),
            "Data Quality Rules" to mapOf("de" to "Datenqualitätsregeln", "fr" to "Règles de qualité des données"),
            "Data Steward" to mapOf("de" to "Daten-Steward", "fr" to "Gestionnaire des données"),
            "Description" to mapOf("de" to "Beschreibung", "fr" to "Description"),
            "Domain Events" to mapOf("de" to "Domänenereignisse", "fr" to "Événements de domaine"),
            "Domain Type" to mapOf("de" to "Domänentyp", "fr" to "Type de domaine"),
            "Executing Processes" to mapOf("de" to "Ausgeführte Prozesse", "fr" to "Processus exécutés"),
            "Executing Units" to mapOf("de" to "Ausführende Einheiten", "fr" to "Unités exécutantes"),
            "External Company Name" to mapOf("de" to "Name des externen Unternehmens", "fr" to "Nom de l'entreprise externe"),
            "First Pass Yield (%)" to mapOf("de" to "Erstdurchlaufquote (%)", "fr" to "Taux de conformité au premier passage (%)"),
            "Frequency" to mapOf("de" to "Häufigkeit", "fr" to "Fréquence"),
            "IT Systems" to mapOf("de" to "IT-Systeme", "fr" to "Systèmes informatiques"),
            "Implementation Entities" to mapOf("de" to "Implementierungsentitäten", "fr" to "Entités d'implémentation"),
            "Input Data Entities" to mapOf("de" to "Eingehende Datenobjekte", "fr" to "Entités de données en entrée"),
            "Interface Entities" to mapOf("de" to "Schnittstellenentitäten", "fr" to "Entités d'interface"),
            "Is External" to mapOf("de" to "Ist extern", "fr" to "Est externe"),
            "Legal Basis" to mapOf("de" to "Rechtsgrundlage", "fr" to "Base juridique"),
            "Mission Statement" to mapOf("de" to "Mission", "fr" to "Énoncé de mission"),
            "Name" to mapOf("de" to "Name", "fr" to "Nom"),
            "Output Data Entities" to mapOf("de" to "Ausgehende Datenobjekte", "fr" to "Entités de données en sortie"),
            "Owning Unit" to mapOf("de" to "Verantwortliche Einheit", "fr" to "Unité responsable"),
            "Parent Domain" to mapOf("de" to "Übergeordnete Domäne", "fr" to "Domaine parent"),
            "Parent Entity" to mapOf("de" to "Übergeordnete Entität", "fr" to "Entité parente"),
            "Parent Process" to mapOf("de" to "Übergeordneter Prozess", "fr" to "Processus parent"),
            "Parent Units" to mapOf("de" to "Übergeordnete Einheiten", "fr" to "Unités parentes"),
            "Process Code" to mapOf("de" to "Prozesskennzeichen", "fr" to "Code du processus"),
            "Process Diagram" to mapOf("de" to "Prozessdiagramm", "fr" to "Diagramme du processus"),
            "Process Owner" to mapOf("de" to "Prozesseigentümer", "fr" to "Responsable du processus"),
            "Process Steward" to mapOf("de" to "Prozess-Steward", "fr" to "Gestionnaire du processus"),
            "Process Type" to mapOf("de" to "Prozesstyp", "fr" to "Type de processus"),
            "Purpose" to mapOf("de" to "Verarbeitungszweck", "fr" to "Finalité"),
            "Relationships" to mapOf("de" to "Beziehungen", "fr" to "Relations"),
            "Retention Period" to mapOf("de" to "Aufbewahrungsfrist", "fr" to "Durée de conservation"),
            "Security Measures" to mapOf("de" to "Sicherheitsmassnahmen", "fr" to "Mesures de sécurité"),
            "Service Providers" to mapOf("de" to "Dienstleister", "fr" to "Prestataires de services"),
            "Storage Locations" to mapOf("de" to "Speicherorte", "fr" to "Emplacements de stockage"),
            "Team Topology Type" to mapOf("de" to "Team-Topologie-Typ", "fr" to "Type de topologie d'équipe"),
            "Technical Custodian" to mapOf("de" to "Technischer Verwalter", "fr" to "Gardien technique"),
            "Translation Links" to mapOf("de" to "Übersetzungsverknüpfungen", "fr" to "Liens de traduction"),
            "Unit Type" to mapOf("de" to "Einheitentyp", "fr" to "Type d'unité"),
            "Value Stream Type" to mapOf("de" to "Wertstromtyp", "fr" to "Type de chaîne de valeur"),
            "Vision Statement" to mapOf("de" to "Visionsbeschreibung", "fr" to "Énoncé de vision"),
            "Wait Time (min)" to mapOf("de" to "Wartezeit (Min.)", "fr" to "Temps d'attente (min)"),
            // ── per-item collection prefixes ─────────────────────────────────
            "Relationship" to mapOf("de" to "Beziehung", "fr" to "Relation"),
            "Translation Link" to mapOf("de" to "Übersetzungsverknüpfung", "fr" to "Lien de traduction"),
            "Data Quality Rule" to mapOf("de" to "Datenqualitätsregel", "fr" to "Règle de qualité des données"),
            "Interface Entity" to mapOf("de" to "Schnittstellenentität", "fr" to "Entité d'interface"),
            "Implementation Entity" to mapOf("de" to "Implementierungsentität", "fr" to "Entité d'implémentation"),
            "Input Data Entity" to mapOf("de" to "Eingehendes Datenobjekt", "fr" to "Entité de données en entrée"),
            "Output Data Entity" to mapOf("de" to "Ausgehendes Datenobjekt", "fr" to "Entité de données en sortie"),
            "Data Access" to mapOf("de" to "Datenzugriff", "fr" to "Accès aux données"),
            "Data Manipulation" to mapOf("de" to "Datenbearbeitung", "fr" to "Manipulation des données"),
            "Executing Unit" to mapOf("de" to "Ausführende Einheit", "fr" to "Unité exécutante"),
            "Parent Unit" to mapOf("de" to "Übergeordnete Einheit", "fr" to "Unité parente"),
            "Capability" to mapOf("de" to "Fähigkeit", "fr" to "Capacité"),
            "IT System" to mapOf("de" to "IT-System", "fr" to "Système informatique"),
            "Service Provider" to mapOf("de" to "Dienstleister", "fr" to "Prestataire de services"),
            "Cross-Border Transfer" to mapOf("de" to "Grenzüberschreitende Übermittlung", "fr" to "Transfert transfrontalier"),
            // ── sub-fields of a collection item ──────────────────────────────
            "Semantic Difference Note" to mapOf("de" to "Semantische Abweichung", "fr" to "Note de différence sémantique")
        )

    /** [englishLabel] rendered in [locale], falling back to English for unknown locales and labels. */
    fun translate(
        englishLabel: String,
        locale: String
    ): String = translateOrNull(englishLabel, locale) ?: englishLabel

    /**
     * As [translate], but null when the table does not cover [englishLabel] at all — which lets a caller
     * tell "no translation exists" apart from "the translation happens to equal the English".
     */
    fun translateOrNull(
        englishLabel: String,
        locale: String
    ): String? {
        val translations = byLabel[englishLabel] ?: return null
        return translations[locale.lowercase().substringBefore("-")] ?: englishLabel
    }

    /**
     * As [translate], but also aware of the locale suffix the field inventory appends to a per-locale
     * field ("Description (en)"): only the words are translated, the suffix names a locale and stays put.
     *
     * The whole-label lookup is tried first, because several inventory labels legitimately end in
     * parentheses ("Cycle Time (min)") and must not be mistaken for a locale suffix.
     */
    fun translateLabel(
        label: String,
        locale: String
    ): String {
        translateOrNull(label, locale)?.let { return it }
        val match = LOCALE_SUFFIX.matchEntire(label) ?: return label
        val (base, suffix) = match.destructured
        return "${translate(base, locale)} ($suffix)"
    }

    /** Every English label the table covers — used by the coverage test that guards new inventory fields. */
    fun coveredLabels(): Set<String> = byLabel.keys

    /** An inventory label carrying the locale of a per-locale field, e.g. "Description (en)". */
    private val LOCALE_SUFFIX = Regex("""^(.*) \(([a-zA-Z-]{2,10})\)$""")
}
