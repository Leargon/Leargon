package org.leargon.backend.architecture

import spock.lang.Specification

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.util.stream.Collectors

/**
 * The localisation guard rail on the backend.
 *
 * Every {@code *SummaryResponse} used to be built with a hardcoded {@code getName("en")}, which is why a
 * German tenant read "Logistics" instead of "Logistik" wherever one entity referenced another. The
 * mappers now take the tenant default locale from {@code DefaultLocaleProvider}, and the summary DTOs
 * additionally carry the full {@code names} list so the client can render the reader's own language.
 *
 * This spec pins that shape at the source level, because the mistake is invisible at runtime in an
 * English-only test fixture: with {@code "en"} baked in, every assertion still passes.
 */
class LocaleHardcodingSpec extends Specification {

    /** Reads main sources rather than classes: the literal is what matters, and it does not survive compilation. */
    private static List<Path> kotlinSourcesUnder(String relativePackage) {
        def root = Paths.get('src/main/kotlin/org/leargon/backend').resolve(relativePackage)
        if (!Files.isDirectory(root)) {
            throw new IllegalStateException("Expected Kotlin sources at ${root.toAbsolutePath()}")
        }
        Files.walk(root)
                .filter { it.toString().endsWith('.kt') }
                .collect(Collectors.toList())
    }

    private static List<String> offendersIn(String relativePackage, List<String> forbidden, List<String> allowedFiles = []) {
        kotlinSourcesUnder(relativePackage)
                .findAll { !allowedFiles.contains(it.fileName.toString()) }
                .findAll { path ->
                    def text = Files.readString(path)
                    forbidden.any { text.contains(it) }
                }
                .collect { it.fileName.toString() }
    }

    def "no mapper resolves localized text against a hardcoded English locale"() {
        when: "the mapper sources are scanned for a baked-in locale"
        // SummaryMappers documents the old shape in a comment, which is the point of the comment.
        def offenders = offendersIn('mapper', ['getName("en")', 'it.locale == "en"', 'n.locale == "en"'], ['SummaryMappers.kt'])

        then: "they resolve against the tenant default locale instead"
        offenders.isEmpty()
    }

    def "no service resolves localized text against a hardcoded English locale"() {
        when:
        def offenders = offendersIn('service', ['getName("en")', 'it.locale == "en"', 'n.locale == "en"'])

        then:
        offenders.isEmpty()
    }

    def "no controller defaults a locale parameter to English"() {
        when: "controllers are scanned for a hardcoded query-parameter default"
        // A `defaultValue = "en"` silently hands an English export to a tenant whose default is German
        // whenever the caller omits the parameter.
        def offenders = offendersIn('controller', ['defaultValue = "en"'])

        then: "they fall back to DefaultLocaleProvider instead"
        offenders.isEmpty()
    }

    def "every summary DTO built by SummaryMappers carries the full localized name list"() {
        given:
        def source = Files.readString(Paths.get('src/main/kotlin/org/leargon/backend/mapper/SummaryMappers.kt'))

        expect: "the flat `name` fallback is always accompanied by the localised array"
        source.count('LocalizedTextMapper.toModel') >= source.count('getName(defaultLocale)')
    }
}
