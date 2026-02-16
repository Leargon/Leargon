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
@Table(name = "business_entities")
class BusinessEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id

    @Column(name = "`key`", nullable = false, unique = true, length = 500)
    String key

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "data_owner_id", nullable = false)
    User dataOwner

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id", nullable = false)
    User createdBy

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "names", columnDefinition = "TEXT")
    List<LocalizedText> names = new ArrayList<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "descriptions", columnDefinition = "TEXT")
    List<LocalizedText> descriptions = new ArrayList<>()

    @OneToMany(mappedBy = "businessEntity", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    Set<BusinessEntityVersion> versions = new HashSet<>()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_domain_id")
    BusinessDomain businessDomain

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    BusinessEntity parent

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.PERSIST, CascadeType.MERGE], fetch = FetchType.LAZY)
    Set<BusinessEntity> children = new HashSet<>()

    @ManyToMany
    @JoinTable(
            name = "business_entity_interfaces",
            joinColumns = @JoinColumn(name = "interface_id"),
            inverseJoinColumns = @JoinColumn(name = "implementation_id"))
    Set<BusinessEntity> interfaceEntities = new HashSet<>()

    @ManyToMany(mappedBy = "interfaceEntities")
    Set<BusinessEntity> implementationEntities = new HashSet<>()

    @OneToMany(mappedBy = "firstBusinessEntity", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Set<BusinessEntityRelationship> relationshipsFirst = new HashSet<>()

    @OneToMany(mappedBy = "secondBusinessEntity", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    Set<BusinessEntityRelationship> relationshipsSecond = new HashSet<>()

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "classification_assignments", columnDefinition = "TEXT")
    List<ClassificationAssignment> classificationAssignments = new ArrayList<>()

    @DateCreated
    @Column(name = "created_at", nullable = false, updatable = false)
    Instant createdAt

    @DateUpdated
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt

    void addVersion(BusinessEntityVersion businessEntityVersion) {
        versions.add(businessEntityVersion)
        businessEntityVersion.businessEntity = this
    }

    void addChild(BusinessEntity child) {
        children.add(child)
        child.parent = this
    }

    void removeChild(BusinessEntity child) {
        children.remove(child)
        child.parent = null
    }

    void addImplementation(BusinessEntity implementation) {
        implementationEntities.add(implementation)
    }

    void removeImplementation(BusinessEntity implementation) {
        implementationEntities.remove(implementation)
    }

    Set<BusinessEntityRelationship> getAllRelationships() {
        Set<BusinessEntityRelationship> all = new HashSet<>()
        if (relationshipsFirst != null) {
            all.addAll(relationshipsFirst)
        }
        if (relationshipsSecond != null) {
            relationshipsSecond.each { rel ->
                all.add(rel.swapped())
            }
        }
        return all
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
