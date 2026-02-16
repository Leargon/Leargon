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
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

import java.time.Instant

@Serdeable
@Entity
@Table(name = "business_domains")
class BusinessDomain {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    String key

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    BusinessDomain parent

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    Set<BusinessDomain> children = new HashSet<>()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    User createdBy

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    List<LocalizedText> names = new ArrayList<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    List<LocalizedText> descriptions = new ArrayList<>()

    @OneToMany(mappedBy = "businessDomain", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    Set<BusinessDomainVersion> versions = new HashSet<>()

    @OneToMany(mappedBy = "businessDomain", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.LAZY)
    Set<BusinessEntity> assignedEntities = new HashSet<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    List<ClassificationAssignment> classificationAssignments = new ArrayList<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    @Column(name = "business_domain_type", length = 20)
    String type

    void addChild(BusinessDomain child) {
        children.add(child)
        child.parent = this
    }

    void removeChild(BusinessDomain child) {
        children.remove(child)
        child.parent = null
    }

    String getEffectiveType() {
        if (type != null) {
            return type
        }
        if (parent != null) {
            return parent.type
        }
        return null
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
