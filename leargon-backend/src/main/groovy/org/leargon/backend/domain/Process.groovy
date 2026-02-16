package org.leargon.backend.domain

import io.micronaut.data.annotation.DateCreated
import io.micronaut.data.annotation.DateUpdated
import io.micronaut.serde.annotation.Serdeable
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinTable
import jakarta.persistence.ManyToMany
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

import java.time.Instant

@Serdeable
@Entity
@Table(name = "processes")
class Process {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    String key

    @Column(name = "code", length = 100)
    String code

    @Column(name = "process_type", length = 20)
    String processType

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "process_owner_id", nullable = false)
    User processOwner

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    User createdBy

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    List<LocalizedText> names = new ArrayList<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    List<LocalizedText> descriptions = new ArrayList<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    List<ClassificationAssignment> classificationAssignments = new ArrayList<>()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_domain_id")
    BusinessDomain businessDomain

    @OneToMany(mappedBy = "process", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    Set<ProcessVersion> versions = new HashSet<>()

    @ManyToMany
    @JoinTable(
            name = "process_entity_inputs",
            joinColumns = @JoinColumn(name = "process_id"),
            inverseJoinColumns = @JoinColumn(name = "business_entity_id"))
    Set<BusinessEntity> inputEntities = new HashSet<>()

    @ManyToMany
    @JoinTable(
            name = "process_entity_outputs",
            joinColumns = @JoinColumn(name = "process_id"),
            inverseJoinColumns = @JoinColumn(name = "business_entity_id"))
    Set<BusinessEntity> outputEntities = new HashSet<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    void addVersion(ProcessVersion version) {
        versions.add(version)
        version.process = this
    }

    String getName(String locale) {
        def text = names.find { it.locale == locale }
        return text ? text.text : names.first().text
    }

    String getDescription(String locale) {
        def text = descriptions.find { it.locale == locale }
        return text ? text.text : descriptions.first().text
    }
}
