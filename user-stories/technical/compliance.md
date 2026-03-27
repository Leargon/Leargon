#### USER STORY 'Update process legal basis'
**AS A** process owner or admin\
**IF** \
**I WANT** to set the legal basis for a business process (Consent, Contract, Legal Obligation, Vital Interests, Public Task, Legitimate Interest)\
**SO THAT** the GDPR Art. 30 / DSG Art. 12 requirement for documented legal basis is met for each processing activity

#### USER STORY 'Update process purpose'
**AS A** process owner or admin\
**IF** \
**I WANT** to document the purpose of a business process as a free-text statement\
**SO THAT** the specific, explicit, and legitimate purpose of the processing activity is recorded as required by GDPR Art. 5(1)(b)

#### USER STORY 'Update process security measures'
**AS A** process owner or admin\
**IF** \
**I WANT** to document the technical and organisational security measures applied to a business process\
**SO THAT** the security context of the processing activity is recorded for the processing register and DPIA documentation

#### USER STORY 'Add cross-border transfer to process'
**AS A** process owner or admin\
**IF** \
**I WANT** to add a cross-border transfer record to a business process by specifying the destination country and the applicable transfer safeguard (Standard Contractual Clauses, Adequacy Decision, Binding Corporate Rules, Derogation)\
**SO THAT** transfers of personal data outside Switzerland or the EU/EEA are documented as required by DSG Art. 16 and GDPR Art. 44

#### USER STORY 'Remove cross-border transfer from process'
**AS A** process owner or admin\
**IF** the transfer record exists\
**I WANT** to remove a cross-border transfer record from a business process\
**SO THAT** the transfer documentation remains accurate when a transfer is discontinued

#### USER STORY 'Create DPIA'
**AS A** process owner or admin\
**IF** \
**I WANT** to trigger a Data Protection Impact Assessment for a business process or business entity\
**SO THAT** the high-risk processing activity is formally assessed as required by GDPR Art. 35 and DSG Art. 22

#### USER STORY 'View DPIA details'
**AS A** logged in user\
**IF** a DPIA exists for a process or entity\
**I WANT** to view the DPIA including its status, risk description, residual risk rating, safeguards, and the user who triggered it\
**SO THAT** I have a complete picture of the privacy risk assessment for that item

#### USER STORY 'Update DPIA risk description'
**AS A** process owner or admin\
**IF** the DPIA is in progress\
**I WANT** to document the identified risks in the DPIA\
**SO THAT** the nature of the privacy risks is recorded as part of the impact assessment

#### USER STORY 'Update DPIA residual risk'
**AS A** process owner or admin\
**IF** the DPIA is in progress\
**I WANT** to set the residual risk level (Low, Medium, High) after applying safeguards\
**SO THAT** the outcome of the risk assessment is formally recorded

#### USER STORY 'Update DPIA safeguards'
**AS A** process owner or admin\
**IF** the DPIA is in progress\
**I WANT** to document the technical and organisational safeguards applied to mitigate the identified risks\
**SO THAT** the risk mitigation measures are captured in the DPIA

#### USER STORY 'Complete DPIA'
**AS A** process owner or admin\
**IF** the DPIA is in progress\
**I WANT** to mark a DPIA as completed\
**SO THAT** the assessment is formally closed and the processing activity can proceed with documented approval

#### USER STORY 'Export processing register as CSV'
**AS AN** admin\
**IF** \
**I WANT** to export the full processing register as a CSV file containing all processes with their legal basis, purpose, data categories, responsible parties, and cross-border transfers\
**SO THAT** I have a machine-readable record of processing activities suitable for regulatory submission (GDPR Art. 30 / DSG Art. 12)

#### USER STORY 'Export data processor list as CSV'
**AS AN** admin\
**IF** \
**I WANT** to export a list of all service providers acting as data processors as a CSV file, including DPA status and linked processes\
**SO THAT** I have a complete record of processor relationships for audit and contractual compliance purposes

#### USER STORY 'Export DPIA register as CSV'
**AS AN** admin\
**IF** \
**I WANT** to export a list of all DPIAs with their status, risk level, and associated process or entity as a CSV file\
**SO THAT** I have a complete record of all impact assessments for regulatory review
