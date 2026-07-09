package org.leargon.backend.e2e

import org.testcontainers.mysql.MySQLContainer
import org.yaml.snakeyaml.Yaml
import spock.lang.Shared
import spock.lang.Specification

import java.sql.Connection
import java.sql.DriverManager

/**
 * Verifies the migration 070 backfill against a real MySQL 8.4 instance, so we know that upgrading a
 * populated production database does not silently lose the personal-data / entity-type facts when
 * those system classifications are retired (071).
 *
 * This is a focused SQL test: it stands up a MySQL 8.4 container with a minimal business_entities
 * table (same column types as production), seeds rows carrying the LEGACY classification-assignment
 * JSON, then executes the EXACT backfill statements read out of migration 070 (so the test can never
 * drift from the migration). It deliberately does not boot the app — only the migration SQL and real
 * MySQL JSON semantics are under test.
 *
 * Lives in the e2e package (Docker-gated `e2eTest` task, excluded from the regular H2 `test` task).
 */
class PersonalDataBackfillMigrationE2ESpec extends Specification {

    @Shared
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4")
            .withDatabaseName("leargon")
            .withUsername("leargon")
            .withPassword("leargon")

    @Shared
    Connection conn

    def setupSpec() {
        mysql.start()
        conn = DriverManager.getConnection(mysql.jdbcUrl, mysql.username, mysql.password)
        // Minimal table mirroring the production column types so MySQL JSON semantics are identical.
        conn.createStatement().execute("""
            CREATE TABLE business_entities (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                `key` VARCHAR(500) NOT NULL,
                classification_assignments JSON NULL,
                contains_personal_data BOOLEAN NULL,
                entity_role VARCHAR(20) NULL
            )
        """)
    }

    def cleanupSpec() {
        conn?.close()
        mysql.stop()
    }

    def "migration 070 backfill maps legacy classification assignments to typed columns"() {
        given: "rows carrying the pre-migration classification-assignment JSON with typed columns unset"
        seed("pii", '[{"classificationKey":"personal-data","valueKey":"personal-data--contains"}]')
        seed("nopii", '[{"classificationKey":"personal-data","valueKey":"personal-data--not-contains"}]')
        seed("subject", '[{"classificationKey":"entity-type","valueKey":"entity-type--role"},{"classificationKey":"personal-data","valueKey":"personal-data--contains"}]')
        seed("untagged", '[]')

        when: "the exact backfill SQL from migration 070 is executed"
        backfillStatements().each { sql -> conn.createStatement().withCloseable { it.execute(sql) } }

        then: "the tri-state boolean is backfilled and untagged rows stay NULL (nothing invented)"
        readBool("pii") == Boolean.TRUE
        readBool("nopii") == Boolean.FALSE
        readBool("subject") == Boolean.TRUE
        readBool("untagged") == null

        and: "the data-subject role is set only where the legacy role tag was present"
        readRole("subject") == "DATA_SUBJECT"
        readRole("pii") == null

        and: "the source assignment JSON is left intact (071 deletes catalog rows only, never entity data)"
        readJson("pii").contains("personal-data--contains")
    }

    private void seed(String key, String json) {
        def ps = conn.prepareStatement(
            "INSERT INTO business_entities (`key`, classification_assignments) VALUES (?, ?)")
        ps.setString(1, key)
        ps.setString(2, json)
        ps.executeUpdate()
        ps.close()
    }

    private Boolean readBool(String key) {
        def rs = conn.createStatement().executeQuery(
            "SELECT contains_personal_data FROM business_entities WHERE `key` = '${key}'")
        rs.next()
        def v = rs.getObject("contains_personal_data")
        if (v == null) return null
        return (v instanceof Boolean) ? v : ((Number) v).intValue() != 0
    }

    private String readRole(String key) {
        def rs = conn.createStatement().executeQuery(
            "SELECT entity_role FROM business_entities WHERE `key` = '${key}'")
        rs.next()
        return rs.getString("entity_role")
    }

    private String readJson(String key) {
        def rs = conn.createStatement().executeQuery(
            "SELECT classification_assignments FROM business_entities WHERE `key` = '${key}'")
        rs.next()
        return rs.getString("classification_assignments")
    }

    /** Read the actual UPDATE statements out of migration 070 so the test cannot drift from it. */
    private static List<String> backfillStatements() {
        def stream = PersonalDataBackfillMigrationE2ESpec
            .getResourceAsStream("/db/changelog/changes/070-add-entity-personal-data-fields.yaml")
        assert stream != null: "migration 070 not found on the classpath"
        Map data = new Yaml().load(stream) as Map
        List<String> out = []
        (data.databaseChangeLog as List).each { entry ->
            def cs = (entry as Map).changeSet as Map
            (cs?.changes as List)?.each { ch ->
                def sqlChange = (ch as Map).sql as Map
                if (sqlChange?.sql) out << (sqlChange.sql as String)
            }
        }
        assert out.size() == 3: "expected 3 backfill statements in migration 070, got ${out.size()}"
        return out
    }
}
