package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "organisation_settings")
class OrganisationSettings {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "eu_representative", length = 500)
    var euRepresentative: String? = null

    @Column(name = "data_protection_officer", length = 500)
    var dataProtectionOfficer: String? = null
}
