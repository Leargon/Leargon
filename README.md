![LeargonLogo.png](LeargonLogo.png)
# 🌌 Léargon

> léargas is Irish for sight, insight, enlightment or visibility

### *The Architect of Process Clarity & Guardian of Data Ontology*

> "In the darkness of fragmented data, hidden workflows, and covered interfaces, **Léargon** is the light that reveals the whole."

**Léargon** is a powerful open-source tool designed to bring order to the chaos of enterprise landscapes. Like a wise seer, it connects complex **Data** with dynamic **Processes**, and mapping to **Domains**, ensuring seamless governance and absolute transparency across your entire fabric, always with the sight on business.

---

## 🛡️ The Vision

In a world of siloed information, seeing the "Big Picture" is a monumental challenge. **Léargon** was forged to:

*   **Forge Visibility:** Unearth hidden dependencies between business objects and their operational paths.
*   **Establish Structure:** Build an unshakable ontology as the foundation for all corporate logic.

## ✨ Core Powers

*   🔮 **Holistic Mapping:** Visualize the entirety of your business objects in a multi-dimensional view.
*   📜 **Ontology Weaver:** Seamlessly weave data models into your live operational workflows.
*   ⚡ **Process Insight:** Detect bottlenecks and structural fractures before they impact your realm.
*   🏛️ **Immutable Governance:** Define policies as enduring as stone, yet as adaptable as light.

## 🚀 Awakening the Guardian

Bring Léargon to life within your infrastructure:
`` docker compose up ``

## Installation details
Frontend-container is exposing per default on port 3000. Backend-container is exposing per default port 8081
Backend is configured to listen to everything starting with /api.

### docker compose details
Use docker-compose.prod.yml for production use
There are some sample values in the variables, but passwords needs to be set.

#### backend
All properties starting with DATASOURCES_DEFAULT_ are the database-connection details.
All properties starting with ADMIN_ are used for the fallback admin, so you have the opportunity to log in all the time, even you misconfigured something in the UI. The fallback admin will get overwritten on every startup with the current configuration.
All properties starting with AZURE_ are used for enabling and configuring Azure Entra ID, if left empty, built-in Sign-Up and Login are used. Preferably use Azure Entra ID.
JWT_SECRET is used for creating a JWT token. Use a self-generated secret. The secret length must be at least 256 bits.

#### frontend
BACKEND_URL is used for pointing to the backend domain, do not postfix with /api, as the application will do that for you.

### helm
This is not yet tested, feel free to try, also feedback is appreciated