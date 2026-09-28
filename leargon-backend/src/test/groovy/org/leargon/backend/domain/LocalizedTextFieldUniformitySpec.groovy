package org.leargon.backend.domain

import spock.lang.Specification

import java.lang.reflect.Field
import java.lang.reflect.ParameterizedType

/**
 * Guards that every localised user-entered string behaves the same way.
 *
 * `List<LocalizedText>` fields are one concept — text a user typed, in one or more languages — but
 * they had drifted into two shapes: most non-null, a few nullable. Nothing ever used the
 * distinction (every reader collapses null and empty), while a non-null Kotlin property over a
 * nullable column throws the moment a NULL appears. That is how GET /processing-register 500ed in
 * production, and it stayed latent in organisational_units.mission_statement.
 *
 * So the invariant is: **no `List<LocalizedText>` property is nullable.** A new field added as
 * nullable fails here instead of shipping and waiting to throw.
 *
 * Reflection over the package rather than a hand-kept list — a list would drift, which is the very
 * failure this guards against. The matching column-level invariant (`IS_NULLABLE = 'NO'`) cannot be
 * asserted here: these specs run on H2 with the schema built from the entities, so Liquibase never
 * executes. It is asserted in the integration suite, which runs the real changelog against MySQL.
 */
class LocalizedTextFieldUniformitySpec extends Specification {

    /** Entities carrying at least one localised field. Kept explicit so a missing import is visible. */
    private static final List<Class<?>> ENTITIES = [
        BoundedContext, BusinessDataQualityRule, BusinessDomain, BusinessEntity,
        BusinessEntityRelationship, Capability, Classification, ClassificationValue,
        ContextRelationship, DomainEvent, Dpia, ItSystem, OrganisationalUnit, Process,
        ProcessFlowNode, ProcessFlowTrack, ServiceProvider, TeamInteraction, TranslationLink,
    ]

    private static boolean isLocalizedTextList(Field f) {
        if (!List.isAssignableFrom(f.type)) return false
        def generic = f.genericType
        if (!(generic instanceof ParameterizedType)) return false
        return ((ParameterizedType) generic).actualTypeArguments*.typeName.any { it.endsWith('.LocalizedText') }
    }

    def "the domain still declares the localised fields this spec is meant to guard"() {
        when: "every List<LocalizedText> field across the domain is collected"
        def fields = ENTITIES.collectMany { cls ->
            cls.declaredFields.findAll { isLocalizedTextList(it) }.collect { "${cls.simpleName}.${it.name}" }
        }

        then: "there are at least as many as when the invariant was established"
        // A silent zero — a renamed type, a moved package — would make the check below pass while
        // guarding nothing. This floor makes that failure loud instead.
        fields.size() >= 39
    }

    def "every localised field defaults to an empty list, never null"() {
        expect: "a freshly constructed entity exposes [] so no caller ever needs a null check"
        // This is the assertion with teeth: verified by making TeamInteraction.notes nullable, which
        // made it fail, then reverting. An earlier version checked for a @Nullable annotation on the
        // backing field instead — Kotlin does not emit one there, so it could never fail and was
        // removed rather than left implying coverage it did not provide.
        ENTITIES.each { cls ->
            def instance = cls.getDeclaredConstructor().newInstance()
            cls.declaredFields.findAll { isLocalizedTextList(it) }.each { f ->
                f.accessible = true
                assert f.get(instance) != null, "${cls.simpleName}.${f.name} initialises to null"
            }
        }
    }
}
