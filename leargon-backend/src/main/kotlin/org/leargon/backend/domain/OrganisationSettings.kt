package org.leargon.backend.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

enum class OrgChartView { HIERARCHICAL, CONTAINER }

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

    @Column(name = "home_country", length = 2)
    var homeCountry: String? = null

    @Column(name = "cognitive_load_threshold")
    var cognitiveLoadThreshold: Double? = null

    @Column(name = "team_interaction_health_threshold")
    var teamInteractionHealthThreshold: Int? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "org_chart_default_view", length = 20)
    var orgChartDefaultView: OrgChartView? = null
}
