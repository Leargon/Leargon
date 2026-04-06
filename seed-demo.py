"""
seed-demo.py — Reset and seed the Léargon e-commerce demo.

Phase 1 (WIPE): Deletes all business data + non-admin users in safe FK order:
  IT systems → data processors → classifications → processes → entities → domains → org units → users

Phase 2 (SEED): Creates fresh e-commerce demo data:
  locales · users · classifications · org units (+ hierarchy + leads) · domains
  (+ types + vision statements) · entities (+ bounded-contexts + data owners + interfaces) ·
  processes (+ hierarchy + bounded-contexts + owners + executing units) ·
  relationships · classification assignments · field configurations (mandatory fields) ·
  data processors (Art. 9 revDSG) · cross-border transfers (Art. 16-17 revDSG) ·
  context relationships · domain events (+ consumers + process links) · translation links ·
  IT systems (+ linked processes) · external org units (body-leasing, DPA link, data access)

Usage:
  python3 seed-demo.py
"""
import urllib.request, json, sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE           = 'http://localhost:8081'
ADMIN_EMAIL    = 'admin@leargon.local'
ADMIN_PASSWORD = 'ChangeMe123!'
DEMO_PASSWORD  = 'Demo1234!'

errors = []


def api(method, path, data=None, token=None):
    url  = f'{BASE}{path}'
    body = json.dumps(data).encode() if data is not None else None
    req  = urllib.request.Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        errors.append(f'{method} {path}: {e.code} {msg[:100]}')
        print(f'  ERR {method} {path} -> {e.code}: {msg[:120]}', file=sys.stderr)
        return {'_error': e.code}


def ok(label, result):
    if '_error' not in result:
        print(f'  ok {label}')
        return True
    return False


def names(*pairs):
    return [{'locale': loc, 'text': txt} for loc, txt in pairs if txt]


def n4(en, de=None, fr=None, it=None, es=None):
    return names(('en', en), ('de', de), ('fr', fr), ('it', it), ('es', es))


# ── Login ──────────────────────────────────────────────────────────────────────
r = api('POST', '/authentication/login',
        {'email': ADMIN_EMAIL, 'password': ADMIN_PASSWORD})
T = r['accessToken']
print('Logged in.\n')


# ── Confirmation ───────────────────────────────────────────────────────────────
print()
print('!' * 60)
print('  WARNING: DESTRUCTIVE OPERATION')
print('!' * 60)
print()
print('This will permanently delete ALL existing catalogue data:')
print('  • All classifications (and their assignments)')
print('  • All business processes (including diagrams)')
print('  • All business entities')
print('  • All business domains')
print('  • All organisational units')
print('  • All non-admin users')
print()
print('It will then create fresh e-commerce demo data in their place.')
print()
print('Type  CONFIRM  and press Enter to proceed, or just press Enter to abort:')
try:
    answer = input('> ').strip()
except (EOFError, KeyboardInterrupt):
    print('\nAborted.')
    sys.exit(0)
if answer != 'CONFIRM':
    print('Aborted.')
    sys.exit(0)
print()


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — WIPE
# ══════════════════════════════════════════════════════════════════════════════
print('=' * 60)
print('PHASE 1: WIPE')
print('=' * 60)


def wipe(label, list_path, delete_path_fn, sort_key=None):
    items = api('GET', list_path, token=T)
    if not isinstance(items, list):
        print(f'  skip {label}')
        return
    if sort_key:
        items = sorted(items, key=sort_key)
    for item in items:
        k = item.get('key') or item.get('id')
        api('DELETE', delete_path_fn(k), token=T)
    print(f'  deleted {len(items)} {label}')


print('\n[0a/7] Capabilities...')
# Wipe children before parents
all_caps = api('GET', '/capabilities', token=T)
if isinstance(all_caps, list):
    caps_by_key = {c['key']: c for c in all_caps}
    def cap_depth(c):
        parent_ref = c.get('parent')
        if not parent_ref:
            return 0
        parent_key = parent_ref['key'] if isinstance(parent_ref, dict) else parent_ref
        parent = caps_by_key.get(parent_key)
        return 1 + (cap_depth(parent) if parent else 0)
    caps_sorted = sorted(all_caps, key=lambda c: -cap_depth(c))
    for c in caps_sorted:
        api('DELETE', f'/capabilities/{c["key"]}', token=T)
    print(f'  deleted {len(caps_sorted)} capabilities')

print('\n[0/7] IT systems...')
wipe('IT systems', '/it-systems', lambda k: f'/it-systems/{k}')

print('\n[1/7] Service providers (ex data processors)...')
wipe('service providers', '/service-providers', lambda k: f'/service-providers/{k}')

print('\n[2/7] Classifications...')
_all_classifs = api('GET', '/classifications', token=T)
if isinstance(_all_classifs, list):
    _system_keys = {'personal-data', 'special-categories'}
    _deletable = [c for c in _all_classifs if c.get('key') not in _system_keys]
    for c in _deletable:
        api('DELETE', f'/classifications/{c["key"]}', token=T)
    print(f'  deleted {len(_deletable)} classifications (skipped {len(_all_classifs) - len(_deletable)} system)')

print('[3/7] Processes (clear flows, deepest children first)...')
processes = api('GET', '/processes', token=T)
if isinstance(processes, list):
    # Clear the structured flow for every process so FK-dependent child rows are removed
    for p in processes:
        api('PUT', f'/processes/{p["key"]}/flow', {'nodes': [], 'tracks': []}, T)
    # Sort deepest children first so parents can be deleted after
    procs_by_key = {p['key']: p for p in processes}
    def proc_depth(p):
        parent_ref = p.get('parentProcess')
        if not parent_ref:
            return 0
        parent_key = parent_ref['key'] if isinstance(parent_ref, dict) else parent_ref
        parent = procs_by_key.get(parent_key)
        return 1 + (proc_depth(parent) if parent else 0)
    processes_sorted = sorted(processes, key=lambda p: -proc_depth(p))
    for p in processes_sorted:
        api('DELETE', f'/processes/{p["key"]}', token=T)
    print(f'  deleted {len(processes_sorted)} processes')

print('[4a/7] Translation links...')
wipe('translation links', '/translation-links', lambda k: f'/translation-links/{k}')

print('[4/7] Business entities (children first)...')
wipe('entities', '/business-entities',
     lambda k: f'/business-entities/{k}',
     sort_key=lambda e: -e['key'].count('.'))

print('[5a/7] Domain events...')
wipe('domain events', '/domain-events', lambda k: f'/domain-events/{k}')

print('[5b/7] Context relationships...')
wipe('context relationships', '/context-relationships', lambda k: f'/context-relationships/{k}')

print('[5c/7] Bounded contexts (per domain)...')
all_domains = api('GET', '/business-domains', token=T)
if isinstance(all_domains, list):
    for domain in all_domains:
        bcs = api('GET', f'/business-domains/{domain["key"]}/bounded-contexts', token=T)
        if isinstance(bcs, list):
            for bc in bcs:
                api('DELETE', f'/bounded-contexts/{bc["key"]}', token=T)

print('[5/7] Business domains (children first)...')
wipe('domains', '/business-domains',
     lambda k: f'/business-domains/{k}',
     sort_key=lambda d: -d['key'].count('.'))

print('[6/7] Organisational units...')
wipe('org units', '/organisational-units',
     lambda k: f'/organisational-units/{k}',
     sort_key=lambda o: -o['key'].count('.'))

print('[7/7] Non-admin users...')
all_users = api('GET', '/administration/users', token=T)
if isinstance(all_users, list):
    deleted = 0
    for u in all_users:
        if not u.get('isFallbackAdministrator', False):
            api('DELETE', f'/administration/users/{u["id"]}', token=T)
            deleted += 1
    print(f'  deleted {deleted} users')


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — SEED
# ══════════════════════════════════════════════════════════════════════════════
print('\n' + '=' * 60)
print('PHASE 2: SEED')
print('=' * 60)


# ── 1. Locales ─────────────────────────────────────────────────────────────────
print('\n[1/9] Locales...')
existing_locales = {l['localeCode'] for l in api('GET', '/locales', token=T)}
for loc in [
    {'localeCode': 'en', 'displayName': 'English',  'isDefault': True,  'isActive': True, 'sortOrder': 1},
    {'localeCode': 'de', 'displayName': 'Deutsch',  'isDefault': False, 'isActive': True, 'sortOrder': 2},
    {'localeCode': 'fr', 'displayName': 'Français', 'isDefault': False, 'isActive': True, 'sortOrder': 3},
    {'localeCode': 'it', 'displayName': 'Italiano', 'isDefault': False, 'isActive': True, 'sortOrder': 4},
    {'localeCode': 'es', 'displayName': 'Español',  'isDefault': False, 'isActive': True, 'sortOrder': 5},
]:
    code = loc['localeCode']
    if code not in existing_locales:
        ok(f'locale {code}', api('POST', '/locales', loc, T))
    else:
        print(f'  = locale {code} (exists)')


# ── 2. Users ───────────────────────────────────────────────────────────────────
print('\n[2/9] Users...')

# (username, firstName, lastName, email, role)
user_defs = [
    ('sarah.mitchell', 'Sarah',  'Mitchell',  'sarah.mitchell@leargon.local',  'Head of Sales & Marketing'),
    ('tom.wagner',     'Tom',    'Wagner',    'tom.wagner@leargon.local',       'Finance Manager'),
    ('lisa.chen',      'Lisa',   'Chen',      'lisa.chen@leargon.local',        'Customer Care Manager'),
    ('marco.rossi',    'Marco',  'Rossi',     'marco.rossi@leargon.local',      'Logistics Manager'),
    ('anna.schneider', 'Anna',   'Schneider', 'anna.schneider@leargon.local',   'HR Manager'),
    ('felix.kramer',   'Felix',  'Kramer',    'felix.kramer@leargon.local',     'Head of Engineering'),
    ('petra.vogel',    'Petra',  'Vogel',     'petra.vogel@leargon.local',      'Data Protection Officer'),
]

user_keys = {}
for (username, first, last, email, role) in user_defs:
    result = api('POST', '/administration/users', {
        'email': email, 'username': username, 'password': DEMO_PASSWORD,
        'firstName': first, 'lastName': last,
    }, T)
    if '_error' not in result:
        user_keys[username] = username
        ok(f'{username} ({role})', result)
    else:
        user_keys[username] = username   # assume exists


# ── 3. Classifications ──────────────────────────────────────────────────────────
print('\n[3/9] Classifications...')

classif_defs = [
    {
        'assignableTo': 'BUSINESS_ENTITY',
        'names': n4('Sensitivity', 'Vertraulichkeit', 'Sensibilite', 'Riservatezza', 'Sensibilidad'),
        'values': [
            {'key': 'C1', 'names': n4('Public',       'Öffentlich',    'Public',        'Pubblico',   'Público')},
            {'key': 'C2', 'names': n4('Internal',     'Intern',         'Interne',       'Interno',    'Interno')},
            {'key': 'C3', 'names': n4('Confidential', 'Vertraulich',    'Confidentiel',  'Riservato',  'Confidencial')},
            {'key': 'C4', 'names': n4('Restricted',   'Eingeschränkt', 'Restreint',     'Limitato',   'Restringido')},
        ],
    },
    {
        'assignableTo': 'BUSINESS_ENTITY',
        'names': n4('Data Criticality', 'Datenkritikalität', 'Criticite des données', 'Criticita dei dati', 'Criticidad de datos'),
        'values': [
            {'key': 'critical',   'names': n4('Business Critical', 'Geschäftskritisch', 'Critique metier',   'Critico per il business', 'Crítico para el negocio')},
            {'key': 'important',  'names': n4('Important',         'Wichtig',            'Important',         'Importante',              'Importante')},
            {'key': 'supporting', 'names': n4('Supporting',        'Unterstützend',     'Support',           'Di supporto',             'De apoyo')},
        ],
    },
    # NOTE: Personal Data classification is a system classification (migration 038).
    # It uses value keys 'personal-data--contains' / 'personal-data--not-contains'.
    # Special Categories is also a system classification with keys 'special-categories--health' etc.
    # We do NOT create these here; instead we reference them by their system keys below.
    {
        'assignableTo': 'BUSINESS_PROCESS',
        'names': n4('Process Priority', 'Prozesspriorität', 'Priorite du processus', 'Priorita del processo', 'Prioridad del proceso'),
        'values': [
            {'key': 'critical', 'names': n4('Business Critical', 'Geschäftskritisch', 'Critique metier', 'Critico per il business', 'Crítico para el negocio')},
            {'key': 'high',     'names': n4('High',   'Hoch',   'Haute',   'Alta',  'Alta')},
            {'key': 'medium',   'names': n4('Medium', 'Mittel', 'Moyenne', 'Media', 'Media')},
            {'key': 'low',      'names': n4('Low',    'Niedrig','Faible',  'Bassa', 'Baja')},
        ],
    },
]

classif_keys = {}
for cd in classif_defs:
    en_name = next(x['text'] for x in cd['names'] if x['locale'] == 'en')
    values  = cd.pop('values')
    result  = api('POST', '/classifications', cd, T)
    cd['values'] = values
    if '_error' not in result:
        ck = result['key']
        classif_keys[en_name] = ck
        for v in values:
            api('POST', f'/classifications/{ck}/values', v, T)
        ok(f'{en_name} ({len(values)} values)', result)
    else:
        classif_keys[en_name] = en_name.lower().replace(' ', '-')

S   = classif_keys.get('Sensitivity',    'sensitivity')
DC  = classif_keys.get('Data Criticality', 'data-criticality')
PP  = classif_keys.get('Process Priority', 'process-priority')
# System classifications (created by migration 038, not seeded)
PD  = 'personal-data'   # system classification key
SC  = 'special-categories'  # system classification key


# ── 4. Organisational units ────────────────────────────────────────────────────
print('\n[4/9] Organisational units...')

# (en_name, unit_type, names, descriptions, lead_username)
ou_data = [
    ('Online Shop', 'business-unit',
     n4('Online Shop', 'Onlineshop', 'Boutique en ligne', 'Negozio online', 'Tienda en línea'),
     n4('Manages the e-commerce storefront, product listings and customer experience.',
        'Verwaltet die E-Commerce-Plattform, Produktlistings und das Kundenerlebnis.',
        "Gere la vitrine en ligne, les annonces produits et l'experience client.",
        "Gestisce la piattaforma e-commerce, i listini prodotti e l'esperienza cliente.",
        'Gestiona la tienda en línea, los listados de productos y la experiencia del cliente.'),
     'sarah.mitchell'),

    ('Finance', 'shared-service',
     n4('Finance', 'Finanzen', 'Finance', 'Finanze', 'Finanzas'),
     n4('Responsible for invoicing, payments, accounting and financial reporting.',
        'Verantwortlich für Rechnungsstellung, Zahlungen, Buchhaltung und Finanzberichte.',
        'Responsable de la facturation, des paiements et des reportings financiers.',
        'Responsabile di fatturazione, pagamenti, contabilita e rendicontazione finanziaria.',
        'Responsable de la facturación, los pagos, la contabilidad y los informes financieros.'),
     'tom.wagner'),

    ('Supply Chain', 'shared-service',
     n4('Supply Chain', 'Lieferkette', "Chaine d'approvisionnement", 'Catena di fornitura', 'Cadena de suministro'),
     n4('Coordinates procurement, supplier relationships and inventory management.',
        'Koordiniert Beschaffung, Lieferantenbeziehungen und Bestandsmanagement.',
        'Coordonne les achats, les relations fournisseurs et la gestion des stocks.',
        'Coordina approvvigionamento, relazioni con i fornitori e gestione delle scorte.',
        'Coordina la adquisición, las relaciones con proveedores y la gestión de inventarios.'),
     'marco.rossi'),

    ('Human Resources', 'support-function',
     n4('Human Resources', 'Personalwesen', 'Ressources humaines', 'Risorse umane', 'Recursos humanos'),
     n4('Handles recruitment, employee management and HR processes.',
        'Verantwortlich für Rekrutierung, Mitarbeiterverwaltung und HR-Prozesse.',
        'Gere le recrutement, la gestion des employes et les processus RH.',
        'Gestisce reclutamento, gestione dei dipendenti e processi HR.',
        'Gestiona el reclutamiento, la administración de empleados y los procesos de RRHH.'),
     'anna.schneider'),

    ('Engineering', 'shared-service',
     n4('Engineering', 'Entwicklung', 'Ingenierie', 'Ingegneria', 'Ingeniería'),
     n4('Builds and maintains the platform, APIs and integrations.',
        'Entwickelt und pflegt die Plattform, APIs und Integrationen.',
        'Construit et maintient la plateforme, les API et les integrations.',
        'Costruisce e mantiene la piattaforma, le API e le integrazioni.',
        'Construye y mantiene la plataforma, las API y las integraciones.'),
     'felix.kramer'),

    # Data Protection Officer — cross-functional, sits under Operations
    ('Data Protection Office', 'support-function',
     n4('Data Protection Office', 'Datenschutzbeauftragter', 'Délégué à la protection des données', 'Responsabile della protezione dei dati', 'Delegado de protección de datos'),
     n4('Monitors GDPR and revDSG compliance, manages DPIAs and serves as the Data Protection Authority contact.',
        'Überwacht DSGVO- und revDSG-Konformität, verwaltet DSFAs und ist Ansprechpartner für die Aufsichtsbehörde.',
        'Surveille la conformité RGPD et revLPD, gère les AIPD et assure le contact avec l\'autorité de contrôle.',
        'Monitora la conformità GDPR e revLPD, gestisce le DPIA e funge da contatto con l\'autorità di controllo.',
        'Supervisa el cumplimiento del RGPD y la revLPD, gestiona las EIPD y actúa como contacto con la autoridad de control.'),
     'petra.vogel'),

    # Sub-units of Online Shop
    ('Marketing', 'business-unit',
     n4('Marketing', 'Marketing', 'Marketing', 'Marketing', 'Marketing'),
     n4('Runs campaigns, manages product reviews and drives customer acquisition.',
        'Führt Kampagnen durch, verwaltet Produktbewertungen und treibt Kundengewinnung voran.',
        "Gere les campagnes, les avis produits et l'acquisition client.",
        'Gestisce campagne, recensioni prodotti e acquisizione clienti.',
        'Gestiona campañas, reseñas de productos y la captación de clientes.'),
     'sarah.mitchell'),

    ('Operations', 'business-unit',
     n4('Operations', 'Betrieb', 'Operations', 'Operazioni', 'Operaciones'),
     n4('Oversees day-to-day order processing and customer service operations.',
        'Überwacht die tägliche Auftragsabwicklung und den Kundendienst.',
        'Supervise le traitement quotidien des commandes et le service client.',
        "Supervisiona l'elaborazione giornaliera degli ordini e il servizio clienti.",
        'Supervisa el procesamiento diario de pedidos y las operaciones de atención al cliente.'),
     'lisa.chen'),

    # Sub-unit of Supply Chain
    ('Logistics', 'shared-service',
     n4('Logistics', 'Logistik', 'Logistique', 'Logistica', 'Logística'),
     n4('Manages warehousing, picking, packing and parcel dispatch.',
        'Verwaltet Lagerung, Kommissionierung, Verpackung und Paketversand.',
        "Gere l'entreposage, la preparation, l'emballage et l'expedition des colis.",
        'Gestisce magazzinaggio, prelievo, imballaggio e spedizione dei colli.',
        'Gestiona el almacenamiento, la preparación, el embalaje y el envío de paquetes.'),
     'marco.rossi'),

    # Sub-unit of Finance
    ('Payment', 'shared-service',
     n4('Payment', 'Zahlung', 'Paiement', 'Pagamenti', 'Pagos'),
     n4('Processes payment transactions and manages payment provider integrations.',
        'Verarbeitet Zahlungstransaktionen und verwaltet Zahlungsanbieter-Integrationen.',
        'Traite les transactions et gere les integrations de prestataires de paiement.',
        'Elabora le transazioni di pagamento e gestisce le integrazioni con i provider.',
        'Procesa transacciones de pago y gestiona las integraciones con proveedores de pago.'),
     'tom.wagner'),
]

ou_keys = {}
for (en_name, unit_type, nms, descs, lead) in ou_data:
    result = api('POST', '/organisational-units', {'names': nms, 'descriptions': descs}, T)
    if '_error' not in result:
        ouk = result['key']
        ou_keys[en_name] = ouk
        api('PUT', f'/organisational-units/{ouk}/type', {'unitType': unit_type}, T)
        if lead:
            api('PUT', f'/organisational-units/{ouk}/lead', {'businessOwnerUsername': lead}, T)
        ok(f'{en_name} (type={unit_type}' + (f', lead={lead})' if lead else ')'), result)
    else:
        ou_keys[en_name] = en_name.lower().replace(' ', '-')

# Set org unit parent hierarchy
ou_parents = {
    'Marketing':             'Online Shop',
    'Operations':            'Online Shop',
    'Logistics':             'Supply Chain',
    'Payment':               'Finance',
    'Data Protection Office':'Operations',
}
print('  Setting org unit hierarchy...')
for child_en, parent_en in ou_parents.items():
    child_key  = ou_keys.get(child_en,  child_en.lower().replace(' ', '-'))
    parent_key = ou_keys.get(parent_en, parent_en.lower().replace(' ', '-'))
    ok(f'  {child_key} -> {parent_key}',
       api('PUT', f'/organisational-units/{child_key}/parents', {'keys': [parent_key]}, T))

# Stewards and technical custodians for org units
# (unit_en, business_steward_username, technical_custodian_username)
print('  Setting org unit stewards and custodians...')
ou_governance = [
    ('Online Shop',           'lisa.chen',   'felix.kramer'),
    ('Finance',               'tom.wagner',  'felix.kramer'),
    ('Supply Chain',          'marco.rossi', 'felix.kramer'),
    ('Human Resources',       'anna.schneider', 'felix.kramer'),
    ('Engineering',           'felix.kramer', 'felix.kramer'),
    ('Marketing',             'sarah.mitchell', 'felix.kramer'),
    ('Operations',            'lisa.chen',   'felix.kramer'),
    ('Logistics',             'marco.rossi', 'felix.kramer'),
    ('Payment',               'tom.wagner',  'felix.kramer'),
    ('Data Protection Office','petra.vogel', 'felix.kramer'),
]
for (unit_en, steward, custodian) in ou_governance:
    ukey = ou_keys.get(unit_en, unit_en.lower().replace(' ', '-'))
    api('PUT', f'/organisational-units/{ukey}/steward',
        {'businessStewardUsername': steward}, T)
    api('PUT', f'/organisational-units/{ukey}/technical-custodian',
        {'technicalCustodianUsername': custodian}, T)
print(f'  set governance roles on {len(ou_governance)} units')


# ── 5. Business domains ─────────────────────────────────────────────────────────
print('\n[5/9] Business domains...')

# (en_name, parent_en, domain_type, names, descriptions)
domain_data = [
    ('E-Commerce', None, 'BUSINESS',
     n4('E-Commerce', 'E-Commerce', 'Commerce en ligne', 'E-Commerce', 'Comercio electrónico'),
     n4('Top-level domain encompassing all digital commerce capabilities.',
        'Oberstes Domaingebiet aller digitalen Handelsfähigkeiten.',
        'Domaine de premier niveau englobant toutes les capacites du commerce numerique.',
        'Dominio di primo livello che comprende tutte le capacita del commercio digitale.',
        'Dominio de nivel superior que abarca todas las capacidades del comercio digital.')),

    ('Sales', 'E-Commerce', 'CORE',
     n4('Sales', 'Vertrieb', 'Ventes', 'Vendite', 'Ventas'),
     n4('Covers products, orders, shopping carts, reviews and the sales funnel.',
        'Umfasst Produkte, Bestellungen, Warenkörbe, Bewertungen und den Vertriebstrichter.',
        'Couvre les produits, commandes, paniers, avis et le tunnel de vente.',
        'Copre prodotti, ordini, carrelli, recensioni e il funnel di vendita.',
        'Cubre productos, pedidos, carritos de compra, reseñas y el embudo de ventas.')),

    ('Billing', 'E-Commerce', 'CORE',
     n4('Billing', 'Abrechnung', 'Facturation', 'Fatturazione', 'Facturación'),
     n4('Invoice lifecycle, payment processing and financial reconciliation.',
        'Rechnungslebenszyklus, Zahlungsabwicklung und finanzielle Abstimmung.',
        'Cycle de vie des factures, traitement des paiements et rapprochement financier.',
        'Ciclo di vita delle fatture, elaborazione dei pagamenti e riconciliazione finanziaria.',
        'Ciclo de vida de facturas, procesamiento de pagos y conciliación financiera.')),

    ('Warehouse', 'E-Commerce', 'GENERIC',
     n4('Warehouse', 'Lager', 'Entrepot', 'Magazzino', 'Almacén'),
     n4('Physical storage, inventory tracking and parcel management.',
        'Physische Lagerung, Bestandsverfolgung und Paketverwaltung.',
        'Stockage physique, suivi des stocks et gestion des colis.',
        'Magazzinaggio fisico, tracciamento delle scorte e gestione dei colli.',
        'Almacenamiento físico, seguimiento de inventario y gestión de paquetes.')),

    ('Shipping', 'Warehouse', 'GENERIC',
     n4('Shipping', 'Versand', 'Expedition', 'Spedizione', 'Envíos'),
     n4('Last-mile delivery and carrier integration.',
        'Letzte-Meile-Lieferung und Trägerintegration.',
        "Livraison du dernier kilometre et integration des transporteurs.",
        "Consegna dell'ultimo miglio e integrazione dei corrieri.",
        'Entrega de última milla e integración con transportistas.')),

    ('Marketing', 'E-Commerce', 'GENERIC',
     n4('Marketing', 'Marketing', 'Marketing', 'Marketing', 'Marketing'),
     n4('Campaigns, promotions, product reviews and customer engagement.',
        'Kampagnen, Promotionen, Produktbewertungen und Kundenbindung.',
        'Campagnes, promotions, avis produits et engagement client.',
        'Campagne, promozioni, recensioni prodotti e coinvolgimento dei clienti.',
        'Campañas, promociones, reseñas de productos y fidelización de clientes.')),

    ('Customer Care', 'E-Commerce', 'GENERIC',
     n4('Customer Care', 'Kundenbetreuung', 'Service client', 'Assistenza clienti', 'Atención al cliente'),
     n4('Customer data management, support processes and natural person registry.',
        'Kundendatenverwaltung, Supportprozesse und natürliches Personenregister.',
        'Gestion des donnees clients, processus de support et registre des personnes physiques.',
        'Gestione dei dati clienti, processi di supporto e registro delle persone fisiche.',
        'Gestión de datos de clientes, procesos de soporte y registro de personas físicas.')),

    ('Human Resources', 'E-Commerce', 'SUPPORT',
     n4('Human Resources', 'Personalwesen', 'Ressources humaines', 'Risorse umane', 'Recursos humanos'),
     n4('Employee and applicant lifecycle management.',
        'Verwaltung des Mitarbeiter- und Bewerberlebenszyklus.',
        'Gestion du cycle de vie des employes et des candidats.',
        'Gestione del ciclo di vita di dipendenti e candidati.',
        'Gestión del ciclo de vida de empleados y candidatos.')),
]

domain_vision = {
    'Sales': (
        'Products are discovered, selected and purchased. The Sales bounded context owns the '
        'complete customer purchasing journey from product browsing through order placement.'
    ),
    'Billing': (
        'Payments are collected and invoices are issued. The Billing bounded context is the '
        'financial ledger of the e-commerce platform, ensuring accurate transaction recording.'
    ),
    'Warehouse': (
        'Physical inventory is managed and orders are fulfilled. The Warehouse bounded context '
        'tracks all goods from receipt through dispatch to the shipping carriers.'
    ),
    'Shipping': (
        'Last-mile delivery is coordinated with external carriers. The Shipping bounded context '
        'bridges internal fulfilment with external logistics providers.'
    ),
    'Marketing': (
        'Customer acquisition and engagement are driven through targeted campaigns and promotions. '
        'The Marketing bounded context uses product and order data to reach and retain customers.'
    ),
    'Customer Care': (
        'Customer identities are registered and support is delivered. The Customer Care bounded '
        'context is the single source of truth for natural person data in the platform.'
    ),
    'Human Resources': (
        'Employee and applicant lifecycles are managed. The Human Resources bounded context '
        'maintains the workforce registry and HR processes.'
    ),
}

domain_keys = {}
for (en_name, parent_en, domain_type, nms, descs) in domain_data:
    payload = {'names': nms, 'descriptions': descs}
    if parent_en:
        payload['parentKey'] = domain_keys.get(parent_en, parent_en.lower().replace(' ', '-'))
    result = api('POST', '/business-domains', payload, T)
    if '_error' not in result:
        dkey = result['key']
        domain_keys[en_name] = dkey
        api('PUT', f'/business-domains/{dkey}/type', {'type': domain_type}, T)
        if en_name in domain_vision:
            api('PUT', f'/business-domains/{dkey}/vision-statement',
                {'visionStatement': domain_vision[en_name]}, T)
        if domain_type != 'BUSINESS':
            api('POST', f'/business-domains/{dkey}/bounded-contexts',
                {'names': [{'locale': 'en', 'text': en_name}]}, T)
        ok(f'{en_name} (type={domain_type})', result)
    else:
        domain_keys[en_name] = en_name.lower().replace(' ', '-')

# Assign owning org units to domains — enables computed owner chain
print('  Assigning owning units to domains...')
domain_owning_units = {
    'Sales':          'Online Shop',
    'Billing':        'Finance',
    'Warehouse':      'Supply Chain',
    'Shipping':       'Supply Chain',
    'Marketing':      'Marketing',
    'Customer Care':  'Operations',
    'Human Resources':'Human Resources',
}
for domain_en, unit_en in domain_owning_units.items():
    dkey = domain_keys.get(domain_en, domain_en.lower().replace(' ', '-'))
    ukey = ou_keys.get(unit_en)
    if ukey:
        ok(f'  {domain_en} owned by {unit_en}',
           api('PUT', f'/business-domains/{dkey}/owning-unit', {'owningUnitKey': ukey}, T))


def dk(en_name):
    return domain_keys.get(en_name, en_name.lower().replace(' ', '-'))

def bck(en_name):
    """Bounded context key for a domain: {domainKey}.{domainSlug}"""
    dkey = dk(en_name)
    bc_slug = dkey.rsplit('.', 1)[-1]
    return f"{dkey}.{bc_slug}"


# ── 6. Business entities ────────────────────────────────────────────────────────
print('\n[6/9] Business entities...')

# (en_name, parent_en, domain_en, names, descriptions, data_owner_username)
entity_data = [
    ('Natural Person', None, 'Customer Care',
     n4('Natural Person', 'Natürliche Person', 'Personne physique', 'Persona fisica', 'Persona física'),
     n4('A human individual with legal capacity. Acts as the shared base identity for customers and employees. '
        'The authoritative privacy-law entity under GDPR/revDSG — any processing of personal data is grounded here.',
        'Eine natürliche Person mit Rechtshandlungsfähigkeit. Gemeinsame Basisidentität für Kunden und Mitarbeiter. '
        'Massgebliche datenschutzrechtliche Entität unter DSGVO/revDSG.',
        'Personne physique avec capacite juridique. Identite de base partagee entre clients et employes. '
        'Entite de reference pour le droit de la protection des donnees sous RGPD/revLPD.',
        'Persona fisica con capacita giuridica. Identita base condivisa tra clienti e dipendenti. '
        'Entita di riferimento per la protezione dei dati ai sensi del GDPR/revLPD.',
        'Persona física con capacidad jurídica. Identidad base compartida entre clientes y empleados. '
        'Entidad de referencia en materia de protección de datos bajo RGPD/revLPD.'),
     'lisa.chen'),

    ('Product', None, 'Sales',
     n4('Product', 'Produkt', 'Produit', 'Prodotto', 'Producto'),
     n4('A physical or digital item offered for sale, identified by SKU and organised into categories.',
        'Ein physisches oder digitales Angebot im Onlineshop, identifiziert durch SKU und in Kategorien organisiert.',
        'Un article physique ou numerique en vente, identifie par SKU et organise en categories.',
        'Un articolo fisico o digitale in vendita, identificato da SKU e organizzato in categorie.',
        'Un artículo físico o digital en venta, identificado por SKU y organizado en categorías.'),
     'sarah.mitchell'),

    ('Product Category', None, 'Sales',
     n4('Product Category', 'Produktkategorie', 'Categorie de produit', 'Categoria prodotto', 'Categoría de producto'),
     n4('A hierarchical grouping used to organise and navigate the product catalogue.',
        'Eine hierarchische Gruppierung zur Organisation und Navigation des Produktkatalogs.',
        'Un regroupement hierarchique pour organiser et naviguer dans le catalogue produits.',
        'Un raggruppamento gerarchico per organizzare e navigare nel catalogo prodotti.',
        'Una agrupación jerárquica para organizar y navegar por el catálogo de productos.'),
     'sarah.mitchell'),

    ('Customer', None, 'Customer Care',
     n4('Customer', 'Kunde', 'Client', 'Cliente', 'Cliente'),
     n4('A registered user who can browse products, place orders and manage personal account data.',
        'Ein registrierter Nutzer, der Produkte suchen, Bestellungen aufgeben und persönliche Kontodaten verwalten kann.',
        'Un utilisateur enregistre qui peut parcourir les produits, passer des commandes et gerer ses donnees.',
        'Un utente registrato che puo sfogliare prodotti, effettuare ordini e gestire i propri dati account.',
        'Un usuario registrado que puede explorar productos, realizar pedidos y gestionar sus datos de cuenta.'),
     'lisa.chen'),

    ('Employee', None, 'Human Resources',
     n4('Employee', 'Mitarbeiter', 'Employe', 'Dipendente', 'Empleado'),
     n4('A person employed by the company who operates internal systems and fulfils orders.',
        'Eine vom Unternehmen angestellte Person, die interne Systeme bedient und Bestellungen bearbeitet.',
        "Une personne employee par l'entreprise qui opere les systemes internes et traite les commandes.",
        "Una persona assunta dall'azienda che opera i sistemi interni ed evade gli ordini.",
        'Una persona empleada por la empresa que opera los sistemas internos y gestiona los pedidos.'),
     'anna.schneider'),

    ('Applicant', None, 'Human Resources',
     n4('Applicant', 'Bewerber', 'Candidat', 'Candidato', 'Candidato'),
     n4('An individual who has submitted a job application and may transition to an Employee upon hire.',
        'Eine Person, die sich beworben hat und bei Einstellung zum Mitarbeiter werden kann.',
        'Une personne ayant soumis une candidature et pouvant devenir employe apres embauche.',
        "Una persona che ha presentato una candidatura e puo diventare dipendente dopo l'assunzione.",
        'Una persona que ha enviado una solicitud de empleo y puede convertirse en empleado al ser contratada.'),
     'anna.schneider'),

    ('Order', None, 'Sales',
     n4('Order', 'Bestellung', 'Commande', 'Ordine', 'Pedido'),
     n4('A customer purchase transaction grouping one or more order line items, an invoice and one or more parcels.',
        'Eine Kundenkauftransaktion, die Bestellpositionen, eine Rechnung und Pakete zusammenfasst.',
        "Une transaction d'achat client regroupant des lignes de commande, une facture et des colis.",
        "Una transazione d'acquisto del cliente che raggruppa voci d'ordine, una fattura e uno o piu colli.",
        'Una transacción de compra del cliente que agrupa líneas de pedido, una factura y uno o más paquetes.'),
     'sarah.mitchell'),

    ('Order Line Item', None, 'Sales',
     n4('Order Line Item', 'Bestellposition', "Ligne de commande", "Voce d'ordine", 'Línea de pedido'),
     n4('A single product with a quantity and unit price within an order.',
        'Ein einzelnes Produkt mit Menge und Einzelpreis innerhalb einer Bestellung.',
        'Un produit individuel avec quantite et prix unitaire dans une commande.',
        "Un prodotto con quantita e prezzo unitario all'interno di un ordine.",
        'Un producto individual con cantidad y precio unitario dentro de un pedido.'),
     'sarah.mitchell'),

    ('Invoice', None, 'Billing',
     n4('Invoice', 'Rechnung', 'Facture', 'Fattura', 'Factura'),
     n4('A financial document issued to the customer summarising the purchase and payment obligation.',
        'Ein Finanzdokument, das dem Kunden die Kaufzusammenfassung und Zahlungsverpflichtung mitteilt.',
        'Document financier emis au client resumant l\'achat et l\'obligation de paiement.',
        "Documento finanziario emesso al cliente che riassume l'acquisto e l'obbligo di pagamento.",
        'Documento financiero emitido al cliente que resume la compra y la obligación de pago.'),
     'tom.wagner'),

    ('Parcel', None, 'Warehouse',
     n4('Parcel', 'Paket', 'Colis', 'Collo', 'Paquete'),
     n4('A physical package containing one or more ordered items, prepared for dispatch to the customer.',
        'Ein physisches Paket mit einem oder mehreren bestellten Artikeln, versandfertig fuer den Kunden.',
        'Un colis physique contenant un ou plusieurs articles commandes, pret a etre expedie au client.',
        'Un pacco fisico contenente uno o piu articoli ordinati, pronto per la spedizione al cliente.',
        'Un paquete físico que contiene uno o más artículos pedidos, listo para su envío al cliente.'),
     'marco.rossi'),

    ('Shopping Cart', None, 'Sales',
     n4('Shopping Cart', 'Warenkorb', 'Panier', 'Carrello', 'Carrito de compras'),
     n4('A temporary collection of products a customer intends to purchase before finalising the order.',
        'Eine temporäre Produktsammlung, die ein Kunde kaufen möchte, bevor er die Bestellung abschliesst.',
        "Une collection temporaire de produits qu'un client souhaite acheter avant de finaliser la commande.",
        'Una raccolta temporanea di prodotti che un cliente intende acquistare prima di finalizzare l\'ordine.',
        'Una colección temporal de productos que un cliente desea comprar antes de finalizar el pedido.'),
     'sarah.mitchell'),

    ('Payment Transaction', None, 'Billing',
     n4('Payment Transaction', 'Zahlungstransaktion', 'Transaction de paiement', 'Transazione di pagamento', 'Transacción de pago'),
     n4('A record of a payment attempt or confirmation exchanged with the payment provider.',
        'Ein Datensatz eines Zahlungsversuchs oder einer Zahlungsbestätigung beim Zahlungsanbieter.',
        'Un enregistrement d\'une tentative ou confirmation de paiement echangee avec le prestataire.',
        'Un registro di un tentativo o conferma di pagamento scambiato con il provider di pagamento.',
        'Un registro de un intento o confirmación de pago intercambiado con el proveedor de pago.'),
     'tom.wagner'),

    ('Product Review', None, 'Marketing',
     n4('Product Review', 'Produktbewertung', 'Avis produit', 'Recensione prodotto', 'Reseña de producto'),
     n4('A customer-written rating and text review for a purchased product.',
        'Eine vom Kunden verfasste Bewertung und Textrezension fuer ein gekauftes Produkt.',
        'Une note et un avis textuel rediges par un client pour un produit achete.',
        'Una valutazione e recensione testuale scritta da un cliente per un prodotto acquistato.',
        'Una valoración y reseña escrita por un cliente para un producto comprado.'),
     'sarah.mitchell'),

    ('Billing Address', 'Customer', 'Customer Care',
     n4('Billing Address', 'Rechnungsadresse', 'Adresse de facturation', 'Indirizzo di fatturazione', 'Dirección de facturación'),
     n4('The postal address used for invoicing, associated with a specific customer.',
        'Die Postanschrift fuer die Rechnungsstellung, einem bestimmten Kunden zugeordnet.',
        'L\'adresse postale utilisee pour la facturation, associee a un client specifique.',
        'L\'indirizzo postale utilizzato per la fatturazione, associato a un cliente specifico.',
        'La dirección postal utilizada para la facturación, asociada a un cliente específico.'),
     'lisa.chen'),

    ('Shipping Address', 'Customer', 'Customer Care',
     n4('Shipping Address', 'Lieferadresse', 'Adresse de livraison', 'Indirizzo di spedizione', 'Dirección de entrega'),
     n4('A delivery address registered by the customer for receiving parcels.',
        'Eine vom Kunden registrierte Lieferadresse fuer den Empfang von Paketen.',
        'Une adresse de livraison enregistree par le client pour recevoir des colis.',
        "Un indirizzo di consegna registrato dal cliente per ricevere i colli.",
        'Una dirección de entrega registrada por el cliente para recibir paquetes.'),
     'lisa.chen'),

    ('Full Name', 'Customer', 'Customer Care',
     n4('Full Name', 'Vollständiger Name', 'Nom complet', 'Nome completo', 'Nombre completo'),
     n4("The customer's full legal name as provided during registration. Classified as personal data.",
        'Der vollständige rechtliche Name des Kunden bei der Registrierung. Personenbezogenes Datum.',
        'Le nom complet legal du client fourni lors de la registration. Classifie comme donnee personnelle.',
        'Il nome completo legale del cliente fornito durante la registrazione. Dato personale.',
        'El nombre legal completo del cliente tal como se proporcionó durante el registro. Dato personal.'),
     'lisa.chen'),

    ('Date of Birth', 'Customer', 'Customer Care',
     n4('Date of Birth', 'Geburtsdatum', 'Date de naissance', 'Data di nascita', 'Fecha de nacimiento'),
     n4("The customer's date of birth. Special category personal data under GDPR.",
        'Das Geburtsdatum des Kunden. Besondere Kategorie personenbezogener Daten gemäss DSGVO.',
        'La date de naissance du client. Donnee sensible selon le RGPD.',
        'La data di nascita del cliente. Categoria speciale di dati personali ai sensi del GDPR.',
        'La fecha de nacimiento del cliente. Categoría especial de datos personales según el RGPD.'),
     'lisa.chen'),
]

entity_keys = {}
for (en_name, parent_en, domain_en, nms, descs, owner) in entity_data:
    payload = {'names': nms, 'descriptions': descs}
    if parent_en:
        payload['parentKey'] = entity_keys.get(parent_en, parent_en.lower().replace(' ', '-'))
    result = api('POST', '/business-entities', payload, T)
    if '_error' not in result:
        ekey = result['key']
        entity_keys[en_name] = ekey
        if owner:
            api('PUT', f'/business-entities/{ekey}/data-owner',
                {'dataOwnerUsername': owner}, T)
        if domain_en:
            api('PUT', f'/business-entities/{ekey}/bounded-context',
                {'boundedContextKey': bck(domain_en)}, T)
        ok(f'{en_name}' + (f' (owner={owner}, bc={domain_en})' if owner else ''), result)
    else:
        entity_keys[en_name] = en_name.lower().replace(' ', '-')

def ek(en_name):
    return entity_keys.get(en_name, en_name.lower().replace(' ', '-'))


# ── 6b. Retention periods ───────────────────────────────────────────────────────
print('\n[6b/9] Retention periods...')
# Retention periods follow GDPR Art. 5(1)(e), revDSG Art. 6(4) and applicable commercial law.
retention_periods = {
    'Natural Person':       'As long as relationship is active; deleted within 30 days of erasure request unless legal hold applies.',
    'Customer':             '3 years after last order or account closure, whichever is later.',
    'Employee':             '7 years after end of employment (statutory minimum for payroll and labour law records).',
    'Applicant':            '6 months after rejection or withdrawal of application; 2 years with explicit consent.',
    'Order':                '10 years from order date (commercial law: OR Art. 962 / HGB §257).',
    'Order Line Item':      '10 years from order date (commercial law: OR Art. 962 / HGB §257).',
    'Invoice':              '10 years from invoice date (fiscal retention obligation).',
    'Payment Transaction':  '10 years from transaction date (AML and fiscal retention obligations).',
    'Shopping Cart':        '30 days from last activity or until converted to Order.',
    'Parcel':               '2 years from dispatch date (carrier handover documentation).',
    'Product':              'Indefinitely while product is listed; archived 5 years after discontinuation.',
    'Product Category':     'Indefinitely while in use.',
    'Product Review':       '2 years from publication; deleted within 30 days of reviewer erasure request.',
    'Billing Address':      '10 years from last associated invoice (fiscal retention).',
    'Shipping Address':     '2 years from last associated order.',
    'Full Name':            'Duration of customer relationship plus 3 years; immediately on erasure request.',
    'Date of Birth':        'Duration of customer relationship; immediately on erasure request (special category data).',
}
for entity_en, period in retention_periods.items():
    ekey = ek(entity_en)
    ok(f'  retention: {entity_en}',
       api('PUT', f'/business-entities/{ekey}/retention-period',
           {'retentionPeriod': period}, T))


# ── 7. Entity interfaces ────────────────────────────────────────────────────────
print('\n[7/9] Entity interfaces...')
np = ek('Natural Person')
for entity_en in ('Customer', 'Employee', 'Applicant'):
    k = ek(entity_en)
    ok(f'{k} implements [{np}]',
       api('PUT', f'/business-entities/{k}/interfaces', {'interfaces': [np]}, T))


# ── 8. Processes ────────────────────────────────────────────────────────────────
print('\n[8/9] Processes...')

# (en_name, parent_en, domain_en, names, descriptions, ou_slugs, process_owner_username)
# Parent processes must come before their children in this list.
process_data = [
    ('Customer Registration', None, 'Customer Care',
     n4('Customer Registration', 'Kundenregistrierung', 'Inscription client', 'Registrazione cliente', 'Registro de cliente'),
     n4('Onboards a new customer: collects personal data, validates it and activates the account.',
        'Onboardet einen neuen Kunden: Personendaten sammeln, validieren und Konto aktivieren.',
        "Onboarde un nouveau client: collecte de donnees, validation et activation du compte.",
        'Onboarda un nuovo cliente: raccolta dati personali, validazione e attivazione account.',
        'Incorpora un nuevo cliente: recopila datos personales, los valida y activa la cuenta.'),
     ['operations'], 'lisa.chen'),

    ('Validate Customer Data', 'Customer Registration', 'Customer Care',
     n4('Validate Customer Data', 'Kundendaten validieren', 'Valider les donnees client', 'Validare i dati cliente', 'Validar datos del cliente'),
     n4('Checks completeness and accuracy of customer profile data against defined business rules.',
        'Prueft Vollständigkeit und Richtigkeit von Kundenprofildaten anhand definierter Geschäftsregeln.',
        'Verifie la completude et les donnees du profil client selon les regles metier.',
        'Verifica completezza e accuratezza dei dati del profilo cliente secondo le regole di business.',
        'Verifica la integridad y exactitud de los datos del perfil del cliente según las reglas de negocio.'),
     ['operations'], 'lisa.chen'),

    ('Confirm Email Address', 'Customer Registration', 'Customer Care',
     n4('Confirm Email Address', 'E-Mail-Adresse bestätigen', "Confirmer l'adresse e-mail", "Confermare l'indirizzo e-mail", 'Confirmar dirección de correo'),
     n4("Sends a verification email and confirms the customer's address via a one-time token.",
        'Sendet eine Verifikations-E-Mail und bestätigt die E-Mail-Adresse des Kunden per Einmaltoken.',
        "Envoie un e-mail de verification et confirme l'adresse e-mail du client via un jeton unique.",
        "Invia un'e-mail di verifica e conferma l'indirizzo e-mail del cliente tramite token monouso.",
        'Envía un correo de verificación y confirma la dirección del cliente mediante un token de un solo uso.'),
     ['operations'], 'lisa.chen'),

    ('Place an Order', None, 'Sales',
     n4('Place an Order', 'Bestellung aufgeben', 'Passer une commande', 'Effettuare un ordine', 'Realizar un pedido'),
     n4('End-to-end process covering product search, cart management, checkout and payment confirmation.',
        'End-to-End-Prozess von der Produktsuche ueber den Warenkorb bis zur Zahlungsbestätigung.',
        'Processus de bout en bout couvrant la recherche produit, le panier, le paiement et la confirmation.',
        'Processo end-to-end che copre ricerca prodotto, gestione carrello, checkout e conferma pagamento.',
        'Proceso de extremo a extremo que abarca la búsqueda de productos, el carrito, el pago y la confirmación.'),
     ['operations', 'finance'], 'sarah.mitchell'),

    ('Search for Product', 'Place an Order', 'Sales',
     n4('Search for Product', 'Produkt suchen', 'Rechercher un produit', 'Cercare un prodotto', 'Buscar un producto'),
     n4('Allows customers to search, filter and browse the product catalogue.',
        'Ermöglicht Kunden das Suchen, Filtern und Durchsuchen des Produktkatalogs.',
        'Permet aux clients de rechercher, filtrer et parcourir le catalogue produits.',
        'Permette ai clienti di cercare, filtrare e navigare nel catalogo prodotti.',
        'Permite a los clientes buscar, filtrar y explorar el catálogo de productos.'),
     ['operations'], 'sarah.mitchell'),

    ('Add to Cart', 'Place an Order', 'Sales',
     n4('Add to Cart', 'In den Warenkorb legen', 'Ajouter au panier', 'Aggiungere al carrello', 'Añadir al carrito'),
     n4("Adds a selected product with a given quantity to the customer's active shopping cart.",
        'Fügt ein ausgewähltes Produkt mit einer bestimmten Menge zum aktiven Warenkorb hinzu.',
        "Ajoute un produit selectionne avec une quantite donnee au panier actif du client.",
        'Aggiunge un prodotto selezionato con una quantita specificata al carrello attivo del cliente.',
        'Añade un producto seleccionado con una cantidad determinada al carrito activo del cliente.'),
     ['operations'], 'sarah.mitchell'),

    ('Checkout', 'Place an Order', 'Sales',
     n4('Checkout', 'Kasse', 'Passer en caisse', 'Concludi acquisto', 'Finalizar compra'),
     n4('Converts the shopping cart into a confirmed order after verifying address and payment details.',
        'Wandelt den Warenkorb in eine bestätigte Bestellung um nach Prüfen von Adresse und Zahlung.',
        "Convertit le panier en commande confirmee apres verification de l'adresse et du paiement.",
        "Converte il carrello in un ordine confermato dopo la verifica dell'indirizzo e del pagamento.",
        'Convierte el carrito en un pedido confirmado tras verificar la dirección y los datos de pago.'),
     ['operations', 'finance'], 'sarah.mitchell'),

    ('Validate Shipping Address', 'Checkout', 'Shipping',
     n4('Validate Shipping Address', 'Lieferadresse validieren', "Valider l'adresse de livraison", "Validare l'indirizzo di spedizione", 'Validar dirección de entrega'),
     n4('Verifies that the provided shipping address is complete, correctly formatted and deliverable.',
        'Prüft, ob die angegebene Lieferadresse vollständig, korrekt formatiert und zustellbar ist.',
        "Verifie que l'adresse de livraison est complete, correctement formatee et livrable.",
        "Verifica che l'indirizzo di spedizione sia completo, correttamente formattato e raggiungibile.",
        'Verifica que la dirección de entrega sea completa, esté correctamente formateada y sea entregable.'),
     ['operations', 'logistics'], 'lisa.chen'),

    ('Process Payment', 'Checkout', 'Billing',
     n4('Process Payment', 'Zahlung verarbeiten', 'Traiter le paiement', 'Elaborare il pagamento', 'Procesar pago'),
     n4('Initiates and confirms a payment transaction with the payment provider to settle the order amount.',
        'Initiiert und bestätigt eine Zahlungstransaktion mit dem Zahlungsanbieter für den Bestellbetrag.',
        'Lance et confirme une transaction de paiement avec le prestataire pour regler le montant.',
        "Avvia e conferma una transazione di pagamento con il provider per saldare l'importo dell'ordine.",
        'Inicia y confirma una transacción de pago con el proveedor para liquidar el importe del pedido.'),
     ['payment', 'finance'], 'tom.wagner'),

    ('Send Invoice', 'Checkout', 'Billing',
     n4('Send Invoice', 'Rechnung senden', 'Envoyer la facture', 'Inviare la fattura', 'Enviar factura'),
     n4('Generates an invoice for a confirmed order and delivers it to the customer via email.',
        'Generiert eine Rechnung für eine bestätigte Bestellung und sendet sie per E-Mail an den Kunden.',
        'Genere une facture pour une commande confirmee et la livre au client par e-mail.',
        "Genera una fattura per un ordine confermato e la consegna al cliente via e-mail.",
        'Genera una factura para un pedido confirmado y la entrega al cliente por correo electrónico.'),
     ['finance'], 'tom.wagner'),

    ('Ship Order', None, 'Shipping',
     n4('Ship Order', 'Bestellung versenden', 'Expedier la commande', "Spedire l'ordine", 'Enviar pedido'),
     n4('Coordinates warehouse preparation and carrier handover to deliver the order to the customer.',
        'Koordiniert die Lagervorbereitung und Trägerübergabe für die Lieferung beim Kunden.',
        'Coordonne la preparation en entrepot et la remise au transporteur pour livrer la commande.',
        'Coordina la preparazione in magazzino e la consegna al corriere per recapitare l\'ordine.',
        'Coordina la preparación en almacén y la entrega al transportista para llevar el pedido al cliente.'),
     ['logistics', 'supply-chain'], 'marco.rossi'),

    ('Pick and Pack', 'Ship Order', 'Warehouse',
     n4('Pick and Pack', 'Kommissionierung und Verpackung', 'Preparation et emballage', 'Prelievo e imballaggio', 'Preparar y empacar'),
     n4('Warehouse staff pick ordered items from stock and pack them into parcels for dispatch.',
        'Lagermitarbeiter entnehmen bestellte Artikel aus dem Lager und verpacken sie für den Versand.',
        'Le personnel d\'entrepot prepare les articles commandes et les emballe en colis pour expedition.',
        'Il personale del magazzino preleva gli articoli ordinati e li imballa in colli per la spedizione.',
        'El personal del almacén recoge los artículos pedidos del stock y los empaca en paquetes para su envío.'),
     ['logistics'], 'marco.rossi'),

    # ── Sub-tasks: Customer Registration ───────────────────────────────────────
    ('Collect Personal Data', 'Customer Registration', None,
     n4('Collect Personal Data', 'Personendaten erfassen', 'Collecter les donnees personnelles'),
     n4('Collects name, address and contact details from the new customer.'),
     ['operations'], 'lisa.chen'),
    ('Activate Account', 'Customer Registration', None,
     n4('Activate Account', 'Konto aktivieren', 'Activer le compte'),
     n4('Activates the customer account after successful validation and email confirmation.'),
     ['operations'], 'lisa.chen'),

    # ── Sub-tasks: Validate Customer Data ──────────────────────────────────────
    ('Check Required Fields', 'Validate Customer Data', None,
     n4('Check Required Fields', 'Pflichtfelder prüfen', 'Verifier les champs obligatoires'),
     n4('Verifies that all mandatory profile fields have been provided.'),
     ['operations'], 'lisa.chen'),
    ('Validate Format', 'Validate Customer Data', None,
     n4('Validate Format', 'Format validieren', 'Valider le format'),
     n4('Checks that field values conform to expected formats (e-mail, phone, postal code).'),
     ['operations'], 'lisa.chen'),
    ('Request Missing Data', 'Validate Customer Data', None,
     n4('Request Missing Data', 'Fehlende Daten anfordern', 'Demander les donnees manquantes'),
     n4('Notifies the customer that required fields are missing and requests correction.'),
     ['operations'], 'lisa.chen'),

    # ── Sub-tasks: Confirm Email Address ───────────────────────────────────────
    ('Generate One-Time Token', 'Confirm Email Address', None,
     n4('Generate One-Time Token', 'Einmaltoken generieren', 'Generer un jeton unique'),
     n4('Creates a cryptographically secure one-time verification token for the customer.'),
     ['operations'], 'lisa.chen'),
    ('Send Verification Email', 'Confirm Email Address', None,
     n4('Send Verification Email', 'Bestätigungs-E-Mail senden', "Envoyer l'e-mail de verification"),
     n4('Sends the verification link containing the one-time token to the customer.'),
     ['operations'], 'lisa.chen'),
    ('Mark Email Confirmed', 'Confirm Email Address', None,
     n4('Mark Email Confirmed', 'E-Mail als bestätigt markieren', "Marquer l'e-mail comme confirme"),
     n4('Marks the customer e-mail address as confirmed in the system.'),
     ['operations'], 'lisa.chen'),
    ('Send Reminder Email', 'Confirm Email Address', None,
     n4('Send Reminder Email', 'Erinnerungs-E-Mail senden', "Envoyer l'e-mail de rappel"),
     n4('Sends a reminder when the verification token has expired without being used.'),
     ['operations'], 'lisa.chen'),

    # ── Sub-tasks: Place an Order ───────────────────────────────────────────────
    ('Send Order Confirmation', 'Place an Order', None,
     n4('Send Order Confirmation', 'Auftragsbestätigung senden', "Envoyer la confirmation de commande"),
     n4('Sends an order confirmation e-mail to the customer after successful checkout.'),
     ['operations'], 'sarah.mitchell'),

    # ── Sub-tasks: Search for Product ──────────────────────────────────────────
    ('Enter Search Query', 'Search for Product', None,
     n4('Enter Search Query', 'Suchanfrage eingeben', 'Saisir la requete de recherche'),
     n4('Customer enters keywords or browses a category to initiate a product search.'),
     ['operations'], 'sarah.mitchell'),
    ('Query Product Catalogue', 'Search for Product', None,
     n4('Query Product Catalogue', 'Produktkatalog abfragen', 'Interroger le catalogue produits'),
     n4('Executes the search query against the product catalogue and retrieves matching results.'),
     ['operations'], 'sarah.mitchell'),
    ('Apply Filters', 'Search for Product', None,
     n4('Apply Filters', 'Filter anwenden', 'Appliquer les filtres'),
     n4('Applies customer-selected filters (price, category, brand) to narrow search results.'),
     ['operations'], 'sarah.mitchell'),
    ('Display Results', 'Search for Product', None,
     n4('Display Results', 'Ergebnisse anzeigen', 'Afficher les resultats'),
     n4('Renders the filtered and sorted product list on the storefront.'),
     ['operations'], 'sarah.mitchell'),
    ('Customer Selects Product', 'Search for Product', None,
     n4('Customer Selects Product', 'Kunde wählt Produkt aus', 'Le client selectionne un produit'),
     n4('Customer clicks on a product to view its detail page and proceed to cart.'),
     ['operations'], 'sarah.mitchell'),

    # ── Sub-tasks: Add to Cart ──────────────────────────────────────────────────
    ('Check Stock Availability', 'Add to Cart', None,
     n4('Check Stock Availability', 'Lagerverfügbarkeit prüfen', 'Verifier la disponibilite en stock'),
     n4('Verifies that the requested quantity of the product is available in stock.'),
     ['operations'], 'sarah.mitchell'),
    ('Add Item to Cart', 'Add to Cart', None,
     n4('Add Item to Cart', 'Artikel in den Warenkorb legen', "Ajouter l'article au panier"),
     n4('Adds the selected product and quantity to the customer active shopping cart.'),
     ['operations'], 'sarah.mitchell'),
    ('Update Cart Total', 'Add to Cart', None,
     n4('Update Cart Total', 'Warenkorbsumme aktualisieren', 'Mettre a jour le total du panier'),
     n4('Recalculates the cart subtotal, taxes and estimated shipping after adding an item.'),
     ['operations'], 'sarah.mitchell'),
    ('Show Out-of-Stock Notice', 'Add to Cart', None,
     n4('Show Out-of-Stock Notice', 'Nicht-vorrätig-Hinweis anzeigen', 'Afficher le message de rupture de stock'),
     n4('Displays an out-of-stock message when the requested item is unavailable.'),
     ['operations'], 'sarah.mitchell'),

    # ── Sub-tasks: Checkout ─────────────────────────────────────────────────────
    ('Review Cart', 'Checkout', None,
     n4('Review Cart', 'Warenkorb prüfen', 'Verifier le panier'),
     n4('Customer reviews cart contents, quantities and totals before proceeding to checkout.'),
     ['operations'], 'sarah.mitchell'),
    ('Confirm Order', 'Checkout', None,
     n4('Confirm Order', 'Bestellung bestätigen', 'Confirmer la commande'),
     n4('Creates the confirmed order record after successful payment and address validation.'),
     ['operations', 'finance'], 'sarah.mitchell'),

    # ── Sub-tasks: Validate Shipping Address ───────────────────────────────────
    ('Parse Address Fields', 'Validate Shipping Address', None,
     n4('Parse Address Fields', 'Adressfelder parsen', "Analyser les champs d'adresse"),
     n4('Breaks down the raw address input into structured fields (street, city, postcode, country).'),
     ['operations', 'logistics'], 'lisa.chen'),
    ('Check Completeness', 'Validate Shipping Address', None,
     n4('Check Completeness', 'Vollständigkeit prüfen', 'Verifier la completude'),
     n4('Verifies that all mandatory address fields are present and non-empty.'),
     ['operations', 'logistics'], 'lisa.chen'),
    ('Verify Deliverability', 'Validate Shipping Address', None,
     n4('Verify Deliverability', 'Zustellbarkeit prüfen', 'Verifier la livraison'),
     n4('Checks with the carrier API whether the address is within the delivery zone.'),
     ['logistics'], 'lisa.chen'),
    ('Return Validation Error', 'Validate Shipping Address', None,
     n4('Return Validation Error', 'Validierungsfehler zurückgeben', 'Retourner une erreur de validation'),
     n4('Returns a structured validation error with details about the invalid address fields.'),
     ['operations'], 'lisa.chen'),

    # ── Sub-tasks: Process Payment ─────────────────────────────────────────────
    ('Tokenise Card Data', 'Process Payment', None,
     n4('Tokenise Card Data', 'Kartendaten tokenisieren', 'Tokeniser les donnees de carte'),
     n4('Replaces sensitive card data with a secure token via the PCI-DSS tokenisation service.'),
     ['payment', 'finance'], 'tom.wagner'),
    ('Submit to Payment Gateway', 'Process Payment', None,
     n4('Submit to Payment Gateway', 'An Zahlungsgateway senden', 'Soumettre au passerelle de paiement'),
     n4('Sends the payment authorisation request to the payment gateway with tokenised card data.'),
     ['payment', 'finance'], 'tom.wagner'),
    ('Capture Payment', 'Process Payment', None,
     n4('Capture Payment', 'Zahlung einziehen', 'Capturer le paiement'),
     n4('Captures the authorised payment amount from the gateway to complete the transaction.'),
     ['payment', 'finance'], 'tom.wagner'),
    ('Record Transaction', 'Process Payment', None,
     n4('Record Transaction', 'Transaktion aufzeichnen', 'Enregistrer la transaction'),
     n4('Persists the payment transaction record in the financial ledger.'),
     ['finance'], 'tom.wagner'),
    ('Decline Transaction', 'Process Payment', None,
     n4('Decline Transaction', 'Transaktion ablehnen', 'Decliner la transaction'),
     n4('Logs the declined payment and notifies the customer to retry with a different method.'),
     ['payment', 'finance'], 'tom.wagner'),

    # ── Sub-tasks: Send Invoice ─────────────────────────────────────────────────
    ('Generate Invoice', 'Send Invoice', None,
     n4('Generate Invoice', 'Rechnung generieren', 'Generer la facture'),
     n4('Creates the invoice document from the confirmed order and payment transaction data.'),
     ['finance'], 'tom.wagner'),
    ('Render as PDF', 'Send Invoice', None,
     n4('Render as PDF', 'Als PDF rendern', 'Rendre en PDF'),
     n4('Converts the invoice data into a formatted PDF document for delivery.'),
     ['finance'], 'tom.wagner'),
    ('Send Email to Customer', 'Send Invoice', None,
     n4('Send Email to Customer', 'E-Mail an Kunden senden', "Envoyer l'e-mail au client"),
     n4('Delivers the PDF invoice to the customer via e-mail.'),
     ['finance'], 'tom.wagner'),
    ('Log Delivery Status', 'Send Invoice', None,
     n4('Log Delivery Status', 'Lieferstatus protokollieren', 'Journaliser le statut de livraison'),
     n4('Records the invoice delivery status and timestamp in the audit log.'),
     ['finance'], 'tom.wagner'),

    # ── Sub-tasks: Ship Order ───────────────────────────────────────────────────
    ('Assign Carrier', 'Ship Order', None,
     n4('Assign Carrier', 'Spediteur zuweisen', 'Attribuer le transporteur'),
     n4('Selects and assigns a carrier based on destination, weight and service level.'),
     ['logistics', 'supply-chain'], 'marco.rossi'),
    ('Create Shipping Label', 'Ship Order', None,
     n4('Create Shipping Label', 'Versandetikett erstellen', "Creer l'etiquette d'expedition"),
     n4('Generates and prints the carrier shipping label with tracking barcode.'),
     ['logistics'], 'marco.rossi'),
    ('Hand Over to Carrier', 'Ship Order', None,
     n4('Hand Over to Carrier', 'An Spediteur übergeben', 'Remettre au transporteur'),
     n4('Transfers the sealed parcel to the carrier and records the pickup confirmation.'),
     ['logistics'], 'marco.rossi'),
    ('Update Tracking Status', 'Ship Order', None,
     n4('Update Tracking Status', 'Tracking-Status aktualisieren', 'Mettre a jour le statut de suivi'),
     n4('Updates the order tracking status to Dispatched and notifies the customer.'),
     ['logistics'], 'marco.rossi'),

    # ── Sub-tasks: Pick and Pack ────────────────────────────────────────────────
    ('Retrieve Order Manifest', 'Pick and Pack', None,
     n4('Retrieve Order Manifest', 'Auftragsmanifest abrufen', "Recuperer le manifeste de commande"),
     n4('Pulls the picking list from the warehouse management system for the given order.'),
     ['logistics'], 'marco.rossi'),
    ('Pick Items from Shelves', 'Pick and Pack', None,
     n4('Pick Items from Shelves', 'Artikel aus Regalen entnehmen', 'Prelever les articles des rayons'),
     n4('Warehouse staff physically locate and collect each item from the designated shelf location.'),
     ['logistics'], 'marco.rossi'),
    ('Pack Items', 'Pick and Pack', None,
     n4('Pack Items', 'Artikel verpacken', 'Emballer les articles'),
     n4('Places all picked items into an appropriately sized shipping box with protective packaging.'),
     ['logistics'], 'marco.rossi'),
    ('Seal Parcel', 'Pick and Pack', None,
     n4('Seal Parcel', 'Paket versiegeln', 'Sceller le colis'),
     n4('Secures and seals the packed box ready for labelling and dispatch.'),
     ['logistics'], 'marco.rossi'),
    ('Apply Shipping Label', 'Pick and Pack', None,
     n4('Apply Shipping Label', 'Versandetikett anbringen', "Apposer l'etiquette d'expedition"),
     n4('Affixes the carrier shipping label to the sealed parcel.'),
     ['logistics'], 'marco.rossi'),
    ('Flag Backorder', 'Pick and Pack', None,
     n4('Flag Backorder', 'Nachlieferung kennzeichnen', 'Signaler une commande en souffrance'),
     n4('Marks the order as a backorder in the WMS when one or more items are out of stock.'),
     ['logistics', 'supply-chain'], 'marco.rossi'),

    # ── HR Domain processes ─────────────────────────────────────────────────────
    ('Recruit Employee', None, 'Human Resources',
     n4('Recruit Employee', 'Mitarbeiter rekrutieren', 'Recruter un employé', 'Reclutare un dipendente', 'Reclutar un empleado'),
     n4('End-to-end hiring process: job posting, applicant screening, interviews and offer.',
        'Vollständiger Einstellungsprozess: Stellenausschreibung, Bewerbersichtung, Gespräche und Angebot.',
        "Processus de recrutement complet: offre d'emploi, tri des candidats, entretiens et proposition.",
        'Processo di assunzione completo: annuncio di lavoro, selezione candidati, colloqui e offerta.',
        'Proceso de contratación completo: publicación, cribado, entrevistas y oferta.'),
     ['human-resources'], 'anna.schneider'),

    ('Post Job Opening', 'Recruit Employee', 'Human Resources',
     n4('Post Job Opening', 'Stelle ausschreiben', 'Publier une offre d\'emploi'),
     n4('Publishes the job description on internal and external job boards.'),
     ['human-resources'], 'anna.schneider'),

    ('Screen Applications', 'Recruit Employee', 'Human Resources',
     n4('Screen Applications', 'Bewerbungen sichten', 'Examiner les candidatures'),
     n4('Reviews incoming applications against the job requirements and shortlists candidates.'),
     ['human-resources'], 'anna.schneider'),

    ('Conduct Interviews', 'Recruit Employee', 'Human Resources',
     n4('Conduct Interviews', 'Vorstellungsgespräche führen', 'Conduire les entretiens'),
     n4('Schedules and runs structured interviews with shortlisted candidates.'),
     ['human-resources'], 'anna.schneider'),

    ('Make Hiring Decision', 'Recruit Employee', 'Human Resources',
     n4('Make Hiring Decision', 'Einstellungsentscheidung treffen', 'Prendre la décision d\'embauche'),
     n4('Documents the hiring decision, triggers offer creation or rejection notifications.'),
     ['human-resources'], 'anna.schneider'),

    ('Onboard Employee', None, 'Human Resources',
     n4('Onboard Employee', 'Mitarbeiter einarbeiten', 'Intégrer un employé', 'Onboarding del dipendente', 'Incorporar al empleado'),
     n4('Prepares accounts, equipment and induction materials for a new hire.',
        'Bereitet Konten, Geräte und Einarbeitungsmaterialien für neue Mitarbeiter vor.',
        "Prépare les comptes, l'équipement et les supports d'intégration pour le nouvel employé.",
        "Prepara account, attrezzatura e materiali di inserimento per il nuovo assunto.",
        'Prepara cuentas, equipos y materiales de incorporación para el nuevo empleado.'),
     ['human-resources'], 'anna.schneider'),

    ('Provision IT Access', 'Onboard Employee', 'Human Resources',
     n4('Provision IT Access', 'IT-Zugang bereitstellen', 'Créer les accès informatiques'),
     n4('Creates user accounts, assigns roles and provisions hardware for the new employee.'),
     ['human-resources', 'engineering'], 'felix.kramer'),

    ('Conduct Induction Training', 'Onboard Employee', 'Human Resources',
     n4('Conduct Induction Training', 'Einführungsschulung durchführen', 'Conduire la formation d\'induction'),
     n4('Delivers mandatory onboarding training covering company policies, data protection and safety.'),
     ['human-resources'], 'anna.schneider'),

    ('Handle Right to Erasure Request', None, 'Customer Care',
     n4('Handle Right to Erasure Request', 'Löschanfrage bearbeiten', 'Traiter une demande d\'effacement', 'Gestire la richiesta di cancellazione', 'Gestionar solicitud de supresión'),
     n4('Processes a GDPR/revDSG Art. 17 erasure request: verifies identity, assesses retention obligations and executes deletion.',
        'Bearbeitet eine DSGVO/revDSG-Löschanfrage: prüft Identität, bewertet Aufbewahrungspflichten und führt Löschung durch.',
        "Traite une demande d'effacement RGPD/revLPD Art. 17: vérifie l'identité, évalue les obligations de conservation et exécute la suppression.",
        'Elabora una richiesta di cancellazione GDPR/revLPD Art. 17: verifica identità, valuta obblighi di conservazione e procede alla cancellazione.',
        'Procesa una solicitud de supresión RGPD/revLPD Art. 17: verifica identidad, evalúa obligaciones de retención y ejecuta la eliminación.'),
     ['operations', 'data-protection-office'], 'petra.vogel'),
]

# Legal basis per process (Art. 6 GDPR / Art. 31 revDSG)
process_legal_basis = {
    'Customer Registration':      'CONTRACT',
    'Validate Customer Data':     'CONTRACT',
    'Confirm Email Address':      'CONTRACT',
    'Place an Order':             'CONTRACT',
    'Search for Product':         'CONTRACT',
    'Add to Cart':                'CONTRACT',
    'Checkout':                   'CONTRACT',
    'Validate Shipping Address':  'CONTRACT',
    'Process Payment':            'CONTRACT',
    'Send Invoice':               'LEGAL_OBLIGATION',
    'Ship Order':                 'CONTRACT',
    'Pick and Pack':              'CONTRACT',
    'Recruit Employee':           'CONTRACT',
    'Onboard Employee':           'CONTRACT',
    'Handle Right to Erasure Request': 'LEGAL_OBLIGATION',
}

process_keys = {}
for (en_name, parent_en, domain_en, nms, descs, ou_slugs, proc_owner) in process_data:
    payload = {'names': nms, 'descriptions': descs}
    if parent_en:
        payload['parentProcessKey'] = process_keys.get(
            parent_en, parent_en.lower().replace(' ', '-').replace("'", ''))
    result = api('POST', '/processes', payload, T)
    if '_error' not in result:
        pkey = result['key']
        process_keys[en_name] = pkey
        resolved = [ou_keys.get(s.replace('-', ' ').title(), s) for s in ou_slugs]
        api('PUT', f'/processes/{pkey}/executing-units', {'keys': resolved}, T)
        if proc_owner:
            api('PUT', f'/processes/{pkey}/owner', {'processOwnerUsername': proc_owner}, T)
        if domain_en:
            api('PUT', f'/processes/{pkey}/bounded-context',
                {'boundedContextKey': bck(domain_en)}, T)
        legal_basis = process_legal_basis.get(en_name)
        if legal_basis:
            api('PUT', f'/processes/{pkey}/legal-basis', {'legalBasis': legal_basis}, T)
        parent_label = f', parent={parent_en}' if parent_en else ''
        ok(f'{en_name} (units={resolved}, owner={proc_owner}{parent_label})', result)
    else:
        process_keys[en_name] = en_name.lower().replace(' ', '-').replace("'", '')

def pk(en_name):
    return process_keys.get(en_name, en_name.lower().replace(' ', '-'))


# ── Process purpose, security measures, and input/output entities ─────────────
print('\n[8b/9] Process purpose, security measures & input/output entities...')

common_tom = (
    'Access controls and role-based permissions; encrypted data transmission (TLS 1.3); '
    'encrypted data at rest (AES-256); audit logging; regular encrypted backups; '
    'staff data-protection training; data-minimisation principles applied.'
)
payment_tom = (
    'PCI-DSS compliant processing; tokenisation of card data; end-to-end encryption; '
    'fraud detection and velocity checks; strict access controls; audit logging.'
)

process_details = {
    'Customer Registration': {
        'purpose': (
            'To create and manage customer accounts, collecting the personal data '
            'necessary to provide e-commerce services to new customers.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Natural Person'],
        'outputs': ['Customer'],
    },
    'Validate Customer Data': {
        'purpose': (
            'To verify the accuracy and completeness of customer profile data '
            'against defined business rules before account activation.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Customer'],
        'outputs': ['Customer'],
    },
    'Confirm Email Address': {
        'purpose': (
            'To verify the customer\'s email address via a one-time token, '
            'activating the account and confirming reachability.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Customer'],
        'outputs': ['Customer'],
    },
    'Place an Order': {
        'purpose': (
            'To enable customers to select products, manage their cart, '
            'complete checkout and receive payment confirmation for their purchase.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Customer', 'Product', 'Shopping Cart'],
        'outputs': ['Order'],
    },
    'Search for Product': {
        'purpose': (
            'To allow customers to discover, search and filter products '
            'in the catalogue based on keywords, categories and attributes.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Product Category'],
        'outputs': ['Product'],
    },
    'Add to Cart': {
        'purpose': (
            'To allow customers to select products and add them with a specified '
            'quantity to their active shopping cart prior to checkout.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Product', 'Customer'],
        'outputs': ['Shopping Cart'],
    },
    'Checkout': {
        'purpose': (
            'To convert a customer\'s shopping cart into a confirmed order '
            'after verifying the delivery address and payment details.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Shopping Cart', 'Shipping Address', 'Billing Address'],
        'outputs': ['Order'],
    },
    'Validate Shipping Address': {
        'purpose': (
            'To verify that the provided shipping address is complete, '
            'correctly formatted and deliverable by the selected carrier.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Shipping Address'],
        'outputs': ['Shipping Address'],
    },
    'Process Payment': {
        'purpose': (
            'To initiate and confirm a payment transaction with the payment '
            'provider to settle the order amount on behalf of the customer.'
        ),
        'securityMeasures': payment_tom,
        'inputs':  ['Invoice'],
        'outputs': ['Payment Transaction'],
    },
    'Send Invoice': {
        'purpose': (
            'To generate and deliver a legally required invoice to the customer '
            'for each confirmed order, documenting the purchase and payment obligation.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Order'],
        'outputs': ['Invoice'],
    },
    'Ship Order': {
        'purpose': (
            'To coordinate warehouse preparation and carrier handover so that '
            'the customer\'s order is delivered to the specified address.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Order'],
        'outputs': ['Parcel'],
    },
    'Pick and Pack': {
        'purpose': (
            'To physically pick ordered items from warehouse stock and pack them '
            'securely into parcels ready for carrier collection and dispatch.'
        ),
        'securityMeasures': common_tom,
        'inputs':  ['Order Line Item'],
        'outputs': ['Parcel'],
    },
    'Recruit Employee': {
        'purpose': (
            'To identify, attract and hire qualified candidates by processing applicant '
            'personal data strictly to the extent needed for the hiring decision.'
        ),
        'securityMeasures': (
            'Applicant data restricted to HR and hiring managers; deleted or anonymised within '
            'retention period; DPIA conducted for roles requiring background checks.'
        ),
        'inputs':  ['Applicant'],
        'outputs': ['Employee'],
    },
    'Onboard Employee': {
        'purpose': (
            'To set up a new employee with the accounts, tools and training needed to '
            'start their role, processing only data necessary for system provisioning.'
        ),
        'securityMeasures': (
            'IT access provisioned via role-based access control; credentials delivered securely; '
            'induction training includes mandatory data-protection module.'
        ),
        'inputs':  ['Applicant'],
        'outputs': ['Employee'],
    },
    'Handle Right to Erasure Request': {
        'purpose': (
            'To honour a data subject\'s right to erasure under GDPR Art. 17 / revDSG Art. 32 '
            'by verifying identity, assessing retention holds and executing deletion.'
        ),
        'securityMeasures': (
            'Identity verification before any action; audit trail of all deletion steps; '
            'legal-hold check against fiscal and commercial retention obligations before erasure.'
        ),
        'inputs':  ['Customer', 'Natural Person'],
        'outputs': ['Natural Person'],
    },
}

for proc_en, details in process_details.items():
    pkey = pk(proc_en)
    ok(f'  purpose: {proc_en}',
       api('PUT', f'/processes/{pkey}/purpose',
           {'purpose': details['purpose']}, T))
    ok(f'  securityMeasures: {proc_en}',
       api('PUT', f'/processes/{pkey}/security-measures',
           {'securityMeasures': details['securityMeasures']}, T))
    for entity_en in details.get('inputs', []):
        ekey = ek(entity_en)
        ok(f'  input {entity_en} -> {proc_en}',
           api('POST', f'/processes/{pkey}/inputs', {'entityKey': ekey}, T))
    for entity_en in details.get('outputs', []):
        ekey = ek(entity_en)
        ok(f'  output {entity_en} <- {proc_en}',
           api('POST', f'/processes/{pkey}/outputs', {'entityKey': ekey}, T))


# ── 9. Relationships + classification assignments ──────────────────────────────
print('\n[9/9] Relationships & classification assignments...')


def add_rel(first_en, second_en, fmin, fmax, smin, smax, en, de, fr, it, es):
    fkey = ek(first_en)
    skey = ek(second_en)
    payload = {
        'secondEntityKey': skey,
        'firstCardinalityMinimum':  fmin,
        'firstCardinalityMaximum':  fmax,
        'secondCardinalityMinimum': smin,
        'secondCardinalityMaximum': smax,
        'descriptions': n4(en, de, fr, it, es),
    }
    result = api('POST', f'/business-entities/{fkey}/relationships', payload, T)
    fs = fmax if fmax is not None else 'N'
    ss = smax if smax is not None else 'N'
    ok(f'{fkey} [{fmin}..{fs}] — {skey} [{smin}..{ss}]', result)


print('  Relationships:')
add_rel('Order', 'Order Line Item', 1, None, 1, 1,
        'An Order contains one or more Order Line Items.',
        'Eine Bestellung enthält eine oder mehrere Bestellpositionen.',
        'Une Commande contient une ou plusieurs Lignes de commande.',
        "Un Ordine contiene una o piu Voci d'ordine.",
        'Un Pedido contiene una o más Líneas de pedido.')
add_rel('Order Line Item', 'Product', 1, 1, 0, None,
        'An Order Line Item references exactly one Product; a Product may appear in many Line Items.',
        'Eine Bestellposition referenziert genau ein Produkt; ein Produkt kann in vielen Positionen vorkommen.',
        'Une Ligne de commande reference un Produit; un Produit peut figurer dans plusieurs Lignes.',
        "Una Voce d'ordine referenzia un Prodotto; un Prodotto puo comparire in molte Voci.",
        'Una Línea de pedido referencia un Producto; un Producto puede aparecer en muchas Líneas.')
add_rel('Order', 'Customer', 1, 1, 0, None,
        'Each Order is placed by exactly one Customer; a Customer may have zero or more Orders.',
        'Jede Bestellung wird von genau einem Kunden aufgegeben; ein Kunde kann mehrere Bestellungen haben.',
        'Chaque Commande est passee par un Client; un Client peut avoir plusieurs Commandes.',
        'Ogni Ordine e effettuato da un Cliente; un Cliente puo avere piu Ordini.',
        'Cada Pedido es realizado por un Cliente; un Cliente puede tener cero o más Pedidos.')
add_rel('Order', 'Invoice', 1, 1, 0, 1,
        'Each Order generates at most one Invoice; an Invoice corresponds to exactly one Order.',
        'Jede Bestellung erzeugt höchstens eine Rechnung; eine Rechnung entspricht genau einer Bestellung.',
        'Chaque Commande genere une Facture; une Facture correspond a une Commande.',
        "Ogni Ordine genera al massimo una Fattura; una Fattura corrisponde a un Ordine.",
        'Cada Pedido genera como máximo una Factura; una Factura corresponde a un Pedido.')
add_rel('Order', 'Parcel', 1, None, 1, 1,
        'An Order is fulfilled by one or more Parcels; each Parcel ships exactly one Order.',
        'Eine Bestellung wird durch ein oder mehrere Pakete erfüllt; jedes Paket versendet genau eine Bestellung.',
        'Une Commande est expediee en un ou plusieurs Colis; chaque Colis correspond a une Commande.',
        "Un Ordine e evaso da uno o piu Colli; ogni Collo spedisce un Ordine.",
        'Un Pedido se entrega en uno o más Paquetes; cada Paquete corresponde a un Pedido.')
add_rel('Invoice', 'Customer', 1, 1, 0, None,
        'An Invoice is addressed to exactly one Customer; a Customer may receive many Invoices.',
        'Eine Rechnung ist an genau einen Kunden adressiert; ein Kunde kann viele Rechnungen erhalten.',
        'Une Facture est adressee a un Client; un Client peut recevoir plusieurs Factures.',
        "Una Fattura e indirizzata a un Cliente; un Cliente puo ricevere piu Fatture.",
        'Una Factura está dirigida a un Cliente; un Cliente puede recibir muchas Facturas.')
add_rel('Invoice', 'Payment Transaction', 1, 1, 0, 1,
        'An Invoice is settled by at most one Payment Transaction.',
        'Eine Rechnung wird durch höchstens eine Zahlungstransaktion beglichen.',
        'Une Facture est reglee par une Transaction de paiement.',
        'Una Fattura viene saldata da una Transazione di pagamento.',
        'Una Factura se liquida con como máximo una Transacción de pago.')
add_rel('Payment Transaction', 'Order', 1, 1, 1, 1,
        'A Payment Transaction is linked to exactly one Order.',
        'Eine Zahlungstransaktion ist mit genau einer Bestellung verknüpft.',
        'Une Transaction de paiement est liee a une Commande.',
        "Una Transazione di pagamento e collegata a un Ordine.",
        'Una Transacción de pago está vinculada a exactamente un Pedido.')
add_rel('Shopping Cart', 'Customer', 1, 1, 0, 1,
        'A Shopping Cart belongs to exactly one Customer; a Customer has at most one active Cart.',
        'Ein Warenkorb gehört genau einem Kunden; ein Kunde hat höchstens einen aktiven Warenkorb.',
        "Un Panier appartient a un Client; un Client a au plus un Panier actif.",
        "Un Carrello appartiene a un Cliente; un Cliente ha al massimo un Carrello attivo.",
        'Un Carrito pertenece a un Cliente; un Cliente tiene como máximo un Carrito activo.')
add_rel('Shopping Cart', 'Product', 0, None, 0, None,
        'A Shopping Cart may contain zero or many Products; a Product may appear in many Carts.',
        'Ein Warenkorb kann mehrere Produkte enthalten; ein Produkt kann in vielen Warenkörben liegen.',
        "Un Panier peut contenir plusieurs Produits; un Produit peut figurer dans plusieurs Paniers.",
        "Un Carrello puo contenere piu Prodotti; un Prodotto puo essere in piu Carrelli.",
        'Un Carrito puede contener varios Productos; un Producto puede aparecer en muchos Carritos.')
add_rel('Product', 'Product Category', 0, None, 1, 1,
        'A Product belongs to exactly one Product Category; a Category groups zero or many Products.',
        'Ein Produkt gehört zu genau einer Produktkategorie; eine Kategorie gruppiert mehrere Produkte.',
        "Un Produit appartient a une Categorie de produit; une Categorie regroupe plusieurs Produits.",
        "Un Prodotto appartiene a una Categoria prodotto; una Categoria raggruppa piu Prodotti.",
        'Un Producto pertenece a una Categoría de producto; una Categoría agrupa cero o más Productos.')
add_rel('Product Review', 'Product', 1, 1, 0, None,
        'A Product Review is written for exactly one Product; a Product may have many Reviews.',
        'Eine Produktbewertung ist für genau ein Produkt; ein Produkt kann viele Bewertungen haben.',
        "Un Avis produit porte sur un Produit; un Produit peut avoir plusieurs Avis.",
        "Una Recensione prodotto e scritta per un Prodotto; un Prodotto puo avere piu Recensioni.",
        'Una Reseña de producto se escribe para un Producto; un Producto puede tener muchas Reseñas.')
add_rel('Product Review', 'Customer', 1, 1, 0, None,
        'A Product Review is written by exactly one Customer.',
        'Eine Produktbewertung wird von genau einem Kunden verfasst.',
        "Un Avis produit est redige par un Client.",
        "Una Recensione prodotto e scritta da un Cliente.",
        'Una Reseña de producto es escrita por exactamente un Cliente.')
add_rel('Applicant', 'Employee', 0, 1, 0, 1,
        'An Applicant may be hired and become an Employee.',
        'Ein Bewerber kann eingestellt werden und zum Mitarbeiter werden.',
        "Un Candidat peut etre engage et devenir un Employe.",
        "Un Candidato puo essere assunto e diventare un Dipendente.",
        'Un Candidato puede ser contratado y convertirse en Empleado.')


def assign(path_prefix, key, pairs):
    payload = [{'classificationKey': ck, 'valueKey': vk} for ck, vk in pairs]
    ok(f'{key}: {pairs}',
       api('PUT', f'/{path_prefix}/{key}/classifications', payload, T))


print('  Entity classifications:')
assign('business-entities', ek('Product'),           [(S, 'C1'), (DC, 'critical')])
assign('business-entities', ek('Product Category'),  [(S, 'C1'), (DC, 'supporting')])
assign('business-entities', ek('Product Review'),    [(S, 'C1'), (DC, 'supporting')])
assign('business-entities', ek('Shopping Cart'),     [(S, 'C2'), (DC, 'supporting')])
assign('business-entities', ek('Order Line Item'),   [(S, 'C2'), (DC, 'important')])
assign('business-entities', ek('Order'),             [(S, 'C2'), (DC, 'critical')])
assign('business-entities', ek('Parcel'),            [(S, 'C2'), (DC, 'important')])
assign('business-entities', ek('Applicant'),         [(S, 'C2'), (DC, 'supporting')])
assign('business-entities', ek('Invoice'),           [(S, 'C3'), (DC, 'critical')])
assign('business-entities', ek('Customer'),          [(S, 'C3'), (DC, 'critical')])
assign('business-entities', ek('Natural Person'),    [(S, 'C3'), (DC, 'critical')])
assign('business-entities', ek('Billing Address'),   [(S, 'C3'), (DC, 'important'), (PD, 'personal-data--contains')])
assign('business-entities', ek('Shipping Address'),  [(S, 'C3'), (DC, 'important'), (PD, 'personal-data--contains')])
assign('business-entities', ek('Full Name'),         [(S, 'C3'), (DC, 'important'), (PD, 'personal-data--contains')])
assign('business-entities', ek('Employee'),          [(S, 'C4'), (DC, 'important'), (PD, 'personal-data--contains')])
assign('business-entities', ek('Payment Transaction'),[(S, 'C4'), (DC, 'critical'), (PD, 'personal-data--contains')])
assign('business-entities', ek('Date of Birth'),     [(S, 'C4'), (DC, 'important'), (PD, 'personal-data--contains'), (SC, 'special-categories--none')])

print('  Process classifications:')
for proc_en, prio in [
    ('Place an Order',                    'critical'),
    ('Checkout',                          'critical'),
    ('Process Payment',                   'critical'),
    ('Handle Right to Erasure Request',   'critical'),
    ('Customer Registration',             'high'),
    ('Confirm Email Address',             'high'),
    ('Pick and Pack',                     'high'),
    ('Send Invoice',                      'high'),
    ('Ship Order',                        'high'),
    ('Recruit Employee',                  'high'),
    ('Validate Customer Data',            'medium'),
    ('Validate Shipping Address',         'medium'),
    ('Search for Product',                'medium'),
    ('Add to Cart',                       'medium'),
    ('Onboard Employee',                  'medium'),
]:
    assign('processes', pk(proc_en), [(PP, prio)])


# ── 8c. Process Flows ─────────────────────────────────────────────────────────
print('\n[8c/9] Process flows...')

import uuid as _uuid


def _flow(steps):
    """
    Build a SaveProcessFlowRequest from a simplified step list.

    Each step is a dict with 'type':
      {'type': 'task',    'label': str, 'linked': processKey}
      {'type': 'event',   'definition': str, 'label': str}
      {'type': 'gateway', 'gatewayType': str, 'label': str,
                          'trackLabels': [str, ...],
                          'tracks': [[step, ...], [step, ...]]}

    Returns {'nodes': [...], 'tracks': [...]} for PUT /processes/{key}/flow.
    """
    nodes = []
    tracks = []
    _pos = [0]

    def _np():
        p = _pos[0]; _pos[0] += 1; return p

    def _add(step, track_id=None):
        t = step.get('type', 'task')
        if t == 'task':
            nodes.append({
                'id': str(_uuid.uuid4()), 'position': _np(), 'nodeType': 'TASK',
                'label': step.get('label'), 'linkedProcessKey': step.get('linked'),
                'trackId': track_id,
            })
        elif t == 'event':
            nodes.append({
                'id': str(_uuid.uuid4()), 'position': _np(),
                'nodeType': 'INTERMEDIATE_EVENT',
                'eventDefinition': step.get('definition', 'NONE'),
                'label': step.get('label'), 'trackId': track_id,
            })
        elif t == 'gateway':
            pair_id = str(_uuid.uuid4())
            split_id = str(_uuid.uuid4())
            join_id  = str(_uuid.uuid4())
            gtype = step.get('gatewayType', 'EXCLUSIVE')
            nodes.append({
                'id': split_id, 'position': _np(), 'nodeType': 'GATEWAY_SPLIT',
                'gatewayType': gtype, 'gatewayPairId': pair_id,
                'label': step.get('label'), 'trackId': track_id,
            })
            labels = step.get('trackLabels', [])
            for ti, tsteps in enumerate(step.get('tracks', [])):
                tid = str(_uuid.uuid4())
                tracks.append({
                    'id': tid, 'gatewayNodeId': split_id, 'trackIndex': ti,
                    'label': labels[ti] if ti < len(labels) else None,
                })
                for s in tsteps:
                    _add(s, tid)
            nodes.append({
                'id': join_id, 'position': _np(), 'nodeType': 'GATEWAY_JOIN',
                'gatewayType': gtype, 'gatewayPairId': pair_id, 'trackId': track_id,
            })

    nodes.append({'id': str(_uuid.uuid4()), 'position': _np(), 'nodeType': 'START_EVENT'})
    for step in steps:
        _add(step)
    nodes.append({'id': str(_uuid.uuid4()), 'position': _np(), 'nodeType': 'END_EVENT'})

    return {'nodes': nodes, 'tracks': tracks}


# kept for reference — old BPMN builder no longer used
def _bpmn(pid, nodes, edges, called=None):
    """Legacy BPMN XML builder — replaced by _flow(). Kept to avoid NameError in any
    remaining reference but the return value is no longer sent to the API."""
    DIM = {
        'start':   (36,  36),
        'end':     (36,  36),
        'task':    (100, 80),
        'user':    (100, 80),
        'service': (100, 80),
        'send':    (100, 80),
        'call':    (100, 80),
        'xgw':     (50,  50),
        'pgw':     (50,  50),
    }
    TAG = {
        'start':   'startEvent',
        'end':     'endEvent',
        'task':    'task',
        'user':    'userTask',
        'service': 'serviceTask',
        'send':    'sendTask',
        'call':    'callActivity',
        'xgw':     'exclusiveGateway',
        'pgw':     'parallelGateway',
    }
    nmap = {n[0]: n for n in nodes}
    proc, shapes, fedges = [], [], []

    for eid, et, lbl, cx, cy in nodes:
        w, h = DIM[et]
        ce = f' calledElement="{called[eid]}"' if (et == 'call' and called and eid in called) else ''
        proc.append(f'<{TAG[et]} id="{eid}" name="{_e(lbl)}"{ce}/>')
        shapes.append(
            f'<bpmndi:BPMNShape id="{eid}_di" bpmnElement="{eid}">'
            f'<dc:Bounds x="{cx - w//2}" y="{cy - h//2}" width="{w}" height="{h}"/>'
            f'</bpmndi:BPMNShape>'
        )

    for fi, fl in enumerate(edges, 1):
        src, tgt = fl[0], fl[1]
        lbl = fl[2] if len(fl) > 2 else ''
        fid = f'{pid}_f{fi}'
        cattr = f' name="{_e(lbl)}"' if lbl else ''
        proc.append(f'<sequenceFlow id="{fid}" sourceRef="{src}" targetRef="{tgt}"{cattr}/>')

        sn, tn = nmap[src], nmap[tgt]
        sw, sh = DIM[sn[1]]
        tw, th = DIM[tn[1]]
        scx, scy, tcx, tcy = sn[3], sn[4], tn[3], tn[4]

        x1 = scx + sw // 2   # right edge of source
        y1 = scy
        x2 = tcx - tw // 2   # left edge of target
        y2 = tcy

        if abs(y1 - y2) < 5:
            wps = f'<di:waypoint x="{x1}" y="{y1}"/><di:waypoint x="{x2}" y="{y2}"/>'
        else:
            mx = (x1 + x2) // 2
            wps = (f'<di:waypoint x="{x1}" y="{y1}"/>'
                   f'<di:waypoint x="{mx}" y="{y1}"/>'
                   f'<di:waypoint x="{mx}" y="{y2}"/>'
                   f'<di:waypoint x="{x2}" y="{y2}"/>')

        fedges.append(
            f'<bpmndi:BPMNEdge id="{fid}_di" bpmnElement="{fid}">{wps}</bpmndi:BPMNEdge>'
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"'
        ' xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"'
        ' xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"'
        ' xmlns:di="http://www.omg.org/spec/DD/20100524/DI"'
        f' id="def_{pid}" targetNamespace="http://bpmn.io/schema/bpmn">'
        f'<process id="{pid}" isExecutable="false">'
        + ''.join(proc)
        + '</process>'
        '<bpmndi:BPMNDiagram id="BPMNDiagram_1">'
        f'<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{pid}">'
        + ''.join(shapes)
        + ''.join(fedges)
        + '</bpmndi:BPMNPlane>'
        '</bpmndi:BPMNDiagram>'
        '</definitions>'
    )


# ── Flow definitions ───────────────────────────────────────────────────────────

_D = {

# ── Customer Registration ──────────────────────────────────────────────────────
'Customer Registration': _flow([
    {'type': 'task', 'label': 'Collect Personal Data',  'linked': pk('Collect Personal Data')},
    {'type': 'task', 'label': 'Validate Customer Data', 'linked': pk('Validate Customer Data')},
    {'type': 'task', 'label': 'Confirm Email Address',  'linked': pk('Confirm Email Address')},
    {'type': 'task', 'label': 'Activate Account',       'linked': pk('Activate Account')},
]),

# ── Validate Customer Data ─────────────────────────────────────────────────────
'Validate Customer Data': _flow([
    {'type': 'task', 'label': 'Check Required Fields', 'linked': pk('Check Required Fields')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'Data Complete?',
     'trackLabels': ['Complete', 'Incomplete'], 'tracks': [
        [{'type': 'task', 'label': 'Validate Format', 'linked': pk('Validate Format')}],
        [{'type': 'task', 'label': 'Request Missing Data', 'linked': pk('Request Missing Data')}],
    ]},
]),

# ── Confirm Email Address ──────────────────────────────────────────────────────
'Confirm Email Address': _flow([
    {'type': 'task', 'label': 'Generate One-Time Token',  'linked': pk('Generate One-Time Token')},
    {'type': 'task', 'label': 'Send Verification Email',  'linked': pk('Send Verification Email')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'Token Verified?',
     'trackLabels': ['Token Received', 'Timeout'], 'tracks': [
        [{'type': 'task', 'label': 'Mark Email Confirmed', 'linked': pk('Mark Email Confirmed')}],
        [{'type': 'task', 'label': 'Send Reminder Email',  'linked': pk('Send Reminder Email')}],
    ]},
]),

# ── Place an Order ─────────────────────────────────────────────────────────────
'Place an Order': _flow([
    {'type': 'task', 'label': 'Search for Product',       'linked': pk('Search for Product')},
    {'type': 'task', 'label': 'Add to Cart',              'linked': pk('Add to Cart')},
    {'type': 'task', 'label': 'Checkout',                 'linked': pk('Checkout')},
    {'type': 'task', 'label': 'Send Order Confirmation',  'linked': pk('Send Order Confirmation')},
]),

# ── Search for Product ─────────────────────────────────────────────────────────
'Search for Product': _flow([
    {'type': 'task', 'label': 'Enter Search Query',       'linked': pk('Enter Search Query')},
    {'type': 'task', 'label': 'Query Product Catalogue',  'linked': pk('Query Product Catalogue')},
    {'type': 'task', 'label': 'Apply Filters',            'linked': pk('Apply Filters')},
    {'type': 'task', 'label': 'Display Results',          'linked': pk('Display Results')},
    {'type': 'task', 'label': 'Customer Selects Product', 'linked': pk('Customer Selects Product')},
]),

# ── Add to Cart ────────────────────────────────────────────────────────────────
'Add to Cart': _flow([
    {'type': 'task', 'label': 'Check Stock Availability', 'linked': pk('Check Stock Availability')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'In Stock?',
     'trackLabels': ['In Stock', 'Out of Stock'], 'tracks': [
        [
            {'type': 'task', 'label': 'Add Item to Cart',        'linked': pk('Add Item to Cart')},
            {'type': 'task', 'label': 'Update Cart Total',       'linked': pk('Update Cart Total')},
        ],
        [{'type': 'task', 'label': 'Show Out-of-Stock Notice',   'linked': pk('Show Out-of-Stock Notice')}],
    ]},
]),

# ── Checkout ───────────────────────────────────────────────────────────────────
'Checkout': _flow([
    {'type': 'task', 'label': 'Review Cart',                 'linked': pk('Review Cart')},
    {'type': 'task', 'label': 'Validate Shipping Address',   'linked': pk('Validate Shipping Address')},
    {'type': 'gateway', 'gatewayType': 'PARALLEL', 'tracks': [
        [{'type': 'task', 'label': 'Process Payment', 'linked': pk('Process Payment')}],
        [{'type': 'task', 'label': 'Send Invoice',    'linked': pk('Send Invoice')}],
    ]},
    {'type': 'task', 'label': 'Confirm Order',               'linked': pk('Confirm Order')},
]),

# ── Validate Shipping Address ──────────────────────────────────────────────────
'Validate Shipping Address': _flow([
    {'type': 'task', 'label': 'Parse Address Fields',       'linked': pk('Parse Address Fields')},
    {'type': 'task', 'label': 'Check Completeness',         'linked': pk('Check Completeness')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'Address Valid?',
     'trackLabels': ['Valid', 'Invalid'], 'tracks': [
        [{'type': 'task', 'label': 'Verify Deliverability',    'linked': pk('Verify Deliverability')}],
        [{'type': 'task', 'label': 'Return Validation Error',  'linked': pk('Return Validation Error')}],
    ]},
]),

# ── Process Payment ────────────────────────────────────────────────────────────
'Process Payment': _flow([
    {'type': 'task', 'label': 'Tokenise Card Data',         'linked': pk('Tokenise Card Data')},
    {'type': 'task', 'label': 'Submit to Payment Gateway',  'linked': pk('Submit to Payment Gateway')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'Authorised?',
     'trackLabels': ['Authorised', 'Declined'], 'tracks': [
        [
            {'type': 'task', 'label': 'Capture Payment',    'linked': pk('Capture Payment')},
            {'type': 'task', 'label': 'Record Transaction', 'linked': pk('Record Transaction')},
        ],
        [{'type': 'task', 'label': 'Decline Transaction',   'linked': pk('Decline Transaction')}],
    ]},
]),

# ── Send Invoice ───────────────────────────────────────────────────────────────
'Send Invoice': _flow([
    {'type': 'task', 'label': 'Generate Invoice',       'linked': pk('Generate Invoice')},
    {'type': 'task', 'label': 'Render as PDF',          'linked': pk('Render as PDF')},
    {'type': 'task', 'label': 'Send Email to Customer', 'linked': pk('Send Email to Customer')},
    {'type': 'task', 'label': 'Log Delivery Status',    'linked': pk('Log Delivery Status')},
]),

# ── Ship Order ─────────────────────────────────────────────────────────────────
'Ship Order': _flow([
    {'type': 'task', 'label': 'Pick and Pack',          'linked': pk('Pick and Pack')},
    {'type': 'task', 'label': 'Assign Carrier',         'linked': pk('Assign Carrier')},
    {'type': 'task', 'label': 'Create Shipping Label',  'linked': pk('Create Shipping Label')},
    {'type': 'task', 'label': 'Hand Over to Carrier',   'linked': pk('Hand Over to Carrier')},
    {'type': 'task', 'label': 'Update Tracking Status', 'linked': pk('Update Tracking Status')},
]),

# ── Pick and Pack ──────────────────────────────────────────────────────────────
'Pick and Pack': _flow([
    {'type': 'task', 'label': 'Retrieve Order Manifest',   'linked': pk('Retrieve Order Manifest')},
    {'type': 'task', 'label': 'Pick Items from Shelves',   'linked': pk('Pick Items from Shelves')},
    {'type': 'gateway', 'gatewayType': 'EXCLUSIVE', 'label': 'All Items Available?',
     'trackLabels': ['All Available', 'Items Missing'], 'tracks': [
        [
            {'type': 'task', 'label': 'Pack Items',             'linked': pk('Pack Items')},
            {'type': 'task', 'label': 'Seal Parcel',            'linked': pk('Seal Parcel')},
            {'type': 'task', 'label': 'Apply Shipping Label',   'linked': pk('Apply Shipping Label')},
        ],
        [{'type': 'task', 'label': 'Flag Backorder',            'linked': pk('Flag Backorder')}],
    ]},
]),

}  # end _D


for proc_en, flow_data in _D.items():
    pkey = pk(proc_en)
    ok(f'flow: {proc_en}',
       api('PUT', f'/processes/{pkey}/flow', flow_data, T))


# ── Field Configurations (Mandatory Fields) ─────────────────────────────────────
print('\n[14] Field configurations (mandatory fields)...')

field_configs = [
    # Business Entity — data quality essentials
    {'entityType': 'BUSINESS_ENTITY', 'fieldName': 'businessDomain'},
    {'entityType': 'BUSINESS_ENTITY', 'fieldName': 'retentionPeriod'},
    {'entityType': 'BUSINESS_ENTITY', 'fieldName': f'classification.{DC}'},
    {'entityType': 'BUSINESS_ENTITY', 'fieldName': f'classification.{S}'},
    # Business Domain — type is always meaningful
    {'entityType': 'BUSINESS_DOMAIN', 'fieldName': 'type'},
    # Business Process — ownership and domain context required
    {'entityType': 'BUSINESS_PROCESS', 'fieldName': 'processOwner'},
    {'entityType': 'BUSINESS_PROCESS', 'fieldName': 'businessDomain'},
    # Organisational Unit — lead accountability required
    {'entityType': 'ORGANISATIONAL_UNIT', 'fieldName': 'lead'},
]

ok('field configurations', api('PUT', '/administration/field-configurations', field_configs, T))


# ── Service Providers & Cross-border Transfers ───────────────────────────────────
print('\n[15] Service providers & cross-border transfers...')

stripe = api('POST', '/service-providers', {
    'names': n4('Stripe', 'Stripe', 'Stripe', 'Stripe', 'Stripe'),
    'processingCountries': ['US', 'IE'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
    'serviceProviderType': 'DATA_PROCESSOR',
}, T)
ok('service provider: Stripe', stripe)

klaviyo = api('POST', '/service-providers', {
    'names': n4('Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo'),
    'processingCountries': ['US'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': False,
    'serviceProviderType': 'DATA_PROCESSOR',
}, T)
ok('service provider: Klaviyo', klaviyo)

dhl = api('POST', '/service-providers', {
    'names': n4('DHL Express', 'DHL Express', 'DHL Express', 'DHL Express', 'DHL Express'),
    'processingCountries': ['DE', 'NL'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
    'serviceProviderType': 'MANAGED_SERVICE',
}, T)
ok('service provider: DHL Express', dhl)

workday = api('POST', '/service-providers', {
    'names': n4('Workday', 'Workday', 'Workday', 'Workday', 'Workday'),
    'processingCountries': ['US', 'IE'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
    'serviceProviderType': 'DATA_PROCESSOR',
}, T)
ok('service provider: Workday', workday)

salesforce = api('POST', '/service-providers', {
    'names': n4('Salesforce', 'Salesforce', 'Salesforce', 'Salesforce', 'Salesforce'),
    'processingCountries': ['US', 'DE'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
    'serviceProviderType': 'DATA_PROCESSOR',
}, T)
ok('service provider: Salesforce', salesforce)

google_analytics = api('POST', '/service-providers', {
    'names': n4('Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4'),
    'processingCountries': ['US'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': False,
    'serviceProviderType': 'DATA_PROCESSOR',
}, T)
ok('service provider: Google Analytics 4', google_analytics)

# Link processes to service providers
if '_error' not in stripe:
    ok('link Process Payment → Stripe',
       api('PUT', f'/service-providers/{stripe["key"]}/linked-processes',
           {'processKeys': [pk('Process Payment')]}, T))

if '_error' not in klaviyo:
    ok('link Customer Registration + Confirm Email → Klaviyo',
       api('PUT', f'/service-providers/{klaviyo["key"]}/linked-processes',
           {'processKeys': [pk('Customer Registration'), pk('Confirm Email Address')]}, T))

if '_error' not in dhl:
    ok('link Ship Order → DHL Express',
       api('PUT', f'/service-providers/{dhl["key"]}/linked-processes',
           {'processKeys': [pk('Ship Order')]}, T))

if '_error' not in workday:
    ok('link Recruit Employee + Onboard Employee → Workday',
       api('PUT', f'/service-providers/{workday["key"]}/linked-processes',
           {'processKeys': [pk('Recruit Employee'), pk('Onboard Employee')]}, T))

if '_error' not in salesforce:
    ok('link Customer Registration → Salesforce',
       api('PUT', f'/service-providers/{salesforce["key"]}/linked-processes',
           {'processKeys': [pk('Customer Registration')]}, T))

if '_error' not in google_analytics:
    ok('link Search for Product → Google Analytics 4',
       api('PUT', f'/service-providers/{google_analytics["key"]}/linked-processes',
           {'processKeys': [pk('Search for Product'), pk('Place an Order')]}, T))

# Storage locations on entities (ISO country codes; replaces old cross-border-transfers on entities)
ok('storage locations: Customer',
   api('PUT', f'/business-entities/{ek("Customer")}/storage-locations',
       {'locations': ['US', 'DE']}, T))

ok('storage locations: Payment Transaction',
   api('PUT', f'/business-entities/{ek("Payment Transaction")}/storage-locations',
       {'locations': ['US', 'IE']}, T))

ok('storage locations: Parcel',
   api('PUT', f'/business-entities/{ek("Parcel")}/storage-locations',
       {'locations': ['DE']}, T))

# Cross-border transfers on processes (Art. 16-17 revDSG)
ok('cross-border transfers: Process Payment',
   api('PUT', f'/processes/{pk("Process Payment")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Payment gateway operated by Stripe (US)'},
       ]}, T))

ok('cross-border transfers: Customer Registration',
   api('PUT', f'/processes/{pk("Customer Registration")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Email verification service via Klaviyo (US); CRM sync via Salesforce (US)'},
       ]}, T))

ok('cross-border transfers: Recruit Employee',
   api('PUT', f'/processes/{pk("Recruit Employee")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Applicant data processed in Workday HCM (US/IE)'},
           {'destinationCountry': 'IE', 'safeguard': 'ADEQUACY_DECISION',
            'notes': 'Workday EU data centre (Ireland) — GDPR adequate jurisdiction'},
       ]}, T))

ok('cross-border transfers: Search for Product',
   api('PUT', f'/processes/{pk("Search for Product")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Behavioural analytics via Google Analytics 4 (US)'},
       ]}, T))

ok('storage locations: Employee',
   api('PUT', f'/business-entities/{ek("Employee")}/storage-locations',
       {'locations': ['DE', 'US', 'IE']}, T))

ok('storage locations: Applicant',
   api('PUT', f'/business-entities/{ek("Applicant")}/storage-locations',
       {'locations': ['DE', 'US', 'IE']}, T))

ok('storage locations: Order',
   api('PUT', f'/business-entities/{ek("Order")}/storage-locations',
       {'locations': ['DE']}, T))

ok('storage locations: Invoice',
   api('PUT', f'/business-entities/{ek("Invoice")}/storage-locations',
       {'locations': ['DE']}, T))


# ── Context Relationships (DDD Strategic Patterns) ────────────────────────────────
print('\n[16] Context relationships...')

# (upstream_domain, downstream_domain, relationship_type, upstream_role, downstream_role, notes)
context_rels = [
    ('Sales', 'Billing', 'CUSTOMER_SUPPLIER',
     'U', 'D',
     'Sales is upstream: placed orders trigger invoice generation in Billing.'),
    ('Sales', 'Warehouse', 'CUSTOMER_SUPPLIER',
     'U', 'D',
     'Sales is upstream: confirmed orders drive fulfilment tasks in Warehouse.'),
    ('Warehouse', 'Shipping', 'CUSTOMER_SUPPLIER',
     'U', 'D',
     'Warehouse is upstream: packed parcels are handed off to the Shipping context.'),
    ('Customer Care', 'Sales', 'OPEN_HOST_SERVICE',
     'OHS', None,
     'Customer Care publishes an open customer-identity API consumed by Sales and other contexts.'),
    ('Sales', 'Marketing', 'CUSTOMER_SUPPLIER',
     'U', 'D',
     'Sales is upstream: product catalogue and order data feed Marketing campaign logic.'),
]

for (up_en, dn_en, rel_type, up_role, dn_role, notes) in context_rels:
    payload = {
        'upstreamBoundedContextKey': bck(up_en),
        'downstreamBoundedContextKey': bck(dn_en),
        'relationshipType': rel_type,
    }
    if up_role:
        payload['upstreamRole'] = up_role
    if dn_role:
        payload['downstreamRole'] = dn_role
    if notes:
        payload['description'] = notes
    ok(f'{up_en} →[{rel_type}]→ {dn_en}',
       api('POST', '/context-relationships', payload, T))


# ── Domain Events ──────────────────────────────────────────────────────────────────
print('\n[17] Domain events...')

# (en_name, publishing_domain, consumer_domains, process_links, en_desc)
domain_event_defs = [
    ('OrderPlaced', 'Sales',
     ['Billing', 'Warehouse'],
     [('Place an Order', 'TRIGGERS')],
     'Raised when a customer successfully places an order. Triggers invoice creation in Billing and fulfilment in Warehouse.'),
    ('OrderCancelled', 'Sales',
     ['Billing', 'Warehouse'],
     [],
     'Raised when an order is cancelled by the customer or by the system (e.g. payment failure). '
     'Triggers credit note creation in Billing and stock reinstatement in Warehouse.'),
    ('PaymentProcessed', 'Billing',
     ['Sales'],
     [('Process Payment', 'TRIGGERS')],
     'Raised when a payment is successfully processed. Allows Sales to confirm the order and proceed to fulfilment.'),
    ('PaymentFailed', 'Billing',
     ['Sales', 'Customer Care'],
     [('Process Payment', 'TRIGGERS')],
     'Raised when a payment attempt is declined by the gateway. Notifies Sales to put the order on hold and Customer Care to contact the customer.'),
    ('InvoiceSent', 'Billing',
     ['Sales'],
     [('Send Invoice', 'TRIGGERS')],
     'Raised when an invoice has been successfully delivered to the customer. Allows Sales to mark the order as fully invoiced.'),
    ('ParcelDispatched', 'Shipping',
     ['Sales', 'Customer Care'],
     [('Ship Order', 'TRIGGERS')],
     'Raised when a parcel is handed over to the carrier. Notifies Sales to mark the order as shipped and Customer Care to send a tracking notification to the customer.'),
    ('ParcelDelivered', 'Shipping',
     ['Sales', 'Customer Care', 'Marketing'],
     [],
     'Raised when the carrier confirms delivery. Triggers order completion in Sales, delivery confirmation in Customer Care and a product-review invitation in Marketing.'),
    ('CustomerRegistered', 'Customer Care',
     ['Marketing', 'Sales'],
     [('Customer Registration', 'TRIGGERS')],
     'Raised when a new customer account is activated. Allows Marketing to trigger a welcome campaign and Sales to enable personalised recommendations.'),
    ('CustomerDataErased', 'Customer Care',
     ['Sales', 'Billing', 'Marketing'],
     [('Handle Right to Erasure Request', 'TRIGGERS')],
     'Raised when all personal data for a customer has been successfully deleted following an Art. 17 erasure request. '
     'Notifies downstream contexts to purge any retained copies.'),
    ('EmployeeHired', 'Human Resources',
     [],
     [('Recruit Employee', 'TRIGGERS')],
     'Raised when a hiring decision is confirmed and an applicant transitions to Employee. '
     'Used internally by HR to trigger the Onboard Employee process.'),
]

for (ev_en, pub_domain, consumer_domains, proc_links, desc) in domain_event_defs:
    ev_payload = {
        'names': [{'locale': 'en', 'text': ev_en}],
        'descriptions': [{'locale': 'en', 'text': desc}],
        'publishingBoundedContextKey': bck(pub_domain),
    }
    ev = api('POST', '/domain-events', ev_payload, T)
    if '_error' not in ev:
        evk = ev['key']
        # Set consumers
        consumer_keys = [bck(d) for d in consumer_domains]
        ok(f'{ev_en} consumers={consumer_domains}',
           api('PUT', f'/domain-events/{evk}/consumers',
               {'consumerBoundedContextKeys': consumer_keys}, T))
        # Link to processes
        for (proc_en, link_type) in proc_links:
            pkey = pk(proc_en)
            ok(f'{ev_en} linked to {proc_en} ({link_type})',
               api('POST', f'/domain-events/{evk}/process-links',
                   {'processKey': pkey, 'linkType': link_type}, T))
        ok(f'domain event: {ev_en}', ev)
    else:
        print(f'  SKIP domain event {ev_en} (error)')


# ── Translation Links ────────────────────────────────────────────────────────────
print('\n[18] Translation links...')

# (first_entity_en, second_entity_en, note)
translation_links = [
    ('Order', 'Invoice',
     'An Order in the Sales context is the upstream representation of the same transaction '
     'that appears as an Invoice in the Billing context. They share the same identity '
     '(order ID = invoice reference) but carry domain-specific attributes.'),
    ('Customer', 'Natural Person',
     'A Customer in the Sales/Customer Care context is a Natural Person who has completed '
     'registration. Natural Person is the privacy-law entity; Customer is the commercial identity.'),
    ('Product', 'Parcel',
     'A Product in the Sales context is the commercial item. When shipped, it is tracked '
     'as a physical Parcel in the Warehouse/Shipping context.'),
    ('Employee', 'Natural Person',
     'An Employee in the HR context is a Natural Person in an employment relationship. '
     'Both share identity data (name, date of birth) but diverge in domain-specific attributes.'),
]

for (first_en, second_en, note) in translation_links:
    ok(f'translation link: {first_en} ↔ {second_en}',
       api('POST', '/translation-links', {
           'firstEntityKey': ek(first_en),
           'secondEntityKey': ek(second_en),
           'semanticDifferenceNote': note,
       }, T))


# ── Business Capability Model (BCM) ─────────────────────────────────────────────
print('\n[18b] Business capabilities (BCM)...')

# Helper to create a capability and return its key
cap_keys = {}

def mk_cap(short_name, names_list, descs_list, parent_en=None, owning_unit_en=None):
    body = {'names': names_list, 'descriptions': descs_list}
    if parent_en and cap_keys.get(parent_en):
        body['parentCapabilityKey'] = cap_keys[parent_en]
    if owning_unit_en and ou_keys.get(owning_unit_en):
        body['owningUnitKey'] = ou_keys[owning_unit_en]
    result = api('POST', '/capabilities', body, T)
    if '_error' not in result:
        cap_keys[short_name] = result['key']
        ok(f'capability: {short_name}', result)
    else:
        cap_keys[short_name] = short_name.lower().replace(' ', '-')

# ── Level 0: Root capability areas ─────────────────────────────────────────────
mk_cap('Sales & Marketing',
    n4('Sales & Marketing', 'Vertrieb & Marketing'),
    n4('Capabilities to attract, convert and retain customers.',
       'Fähigkeiten zur Gewinnung, Konvertierung und Bindung von Kunden.'),
    owning_unit_en='Marketing')

mk_cap('Order Fulfilment',
    n4('Order Fulfilment', 'Auftragsabwicklung'),
    n4('End-to-end capabilities for order processing and delivery.',
       'Durchgängige Fähigkeiten für Auftragsabwicklung und Lieferung.'),
    owning_unit_en='Operations')

mk_cap('Finance & Billing',
    n4('Finance & Billing', 'Finanzen & Abrechnung'),
    n4('Financial transaction management, invoicing and reconciliation.',
       'Verwaltung von Finanztransaktionen, Rechnungsstellung und Abstimmung.'),
    owning_unit_en='Finance')

mk_cap('Platform & Technology',
    n4('Platform & Technology', 'Plattform & Technologie'),
    n4('Technology infrastructure, integrations and platform capabilities.',
       'Technologieinfrastruktur, Integrationen und Plattformfähigkeiten.'),
    owning_unit_en='Engineering')

mk_cap('Compliance & Data Governance',
    n4('Compliance & Data Governance', 'Compliance & Daten-Governance'),
    n4('Regulatory compliance, data privacy and governance capabilities.',
       'Regulatorische Compliance, Datenschutz und Governance-Fähigkeiten.'),
    owning_unit_en='Operations')

# ── Level 1: Sub-capabilities of Sales & Marketing ─────────────────────────────
mk_cap('Product Catalogue Management',
    n4('Product Catalogue Management', 'Produktkatalogverwaltung'),
    n4('Managing product listings, descriptions, pricing and availability.',
       'Verwaltung von Produktlistings, Beschreibungen, Preisen und Verfügbarkeit.'),
    parent_en='Sales & Marketing', owning_unit_en='Marketing')

mk_cap('Customer Acquisition',
    n4('Customer Acquisition', 'Kundengewinnung'),
    n4('Attracting new customers through campaigns and SEO.',
       'Gewinnung neuer Kunden durch Kampagnen und SEO.'),
    parent_en='Sales & Marketing', owning_unit_en='Marketing')

mk_cap('Customer Retention',
    n4('Customer Retention', 'Kundenbindung'),
    n4('Loyalty programmes, personalisation and retention analytics.',
       'Treueprogramme, Personalisierung und Bindungsanalysen.'),
    parent_en='Sales & Marketing', owning_unit_en='Marketing')

mk_cap('Shopping Cart & Checkout',
    n4('Shopping Cart & Checkout', 'Warenkorb & Checkout'),
    n4('Cart management, upsell, coupon redemption and checkout flow.',
       'Warenkorb, Upselling, Einlösung von Gutscheinen und Checkout-Prozess.'),
    parent_en='Sales & Marketing', owning_unit_en='Online Shop')

# ── Level 1: Sub-capabilities of Order Fulfilment ──────────────────────────────
mk_cap('Order Management',
    n4('Order Management', 'Auftragsverwaltung'),
    n4('Order intake, validation, status tracking and amendments.',
       'Auftragserfassung, -validierung, Statusverfolgung und Änderungen.'),
    parent_en='Order Fulfilment', owning_unit_en='Operations')

mk_cap('Warehouse & Inventory',
    n4('Warehouse & Inventory', 'Lager & Bestand'),
    n4('Stock management, pick and pack, and inventory forecasting.',
       'Bestandsverwaltung, Kommissionierung und Bestandsprognosen.'),
    parent_en='Order Fulfilment', owning_unit_en='Logistics')

mk_cap('Shipping & Returns',
    n4('Shipping & Returns', 'Versand & Rücksendungen'),
    n4('Carrier integration, parcel tracking and returns processing.',
       'Spediteurintegration, Paketverfolgung und Retourenbearbeitung.'),
    parent_en='Order Fulfilment', owning_unit_en='Logistics')

# ── Level 1: Sub-capabilities of Finance & Billing ─────────────────────────────
mk_cap('Invoice Management',
    n4('Invoice Management', 'Rechnungsverwaltung'),
    n4('Invoice creation, delivery and lifecycle management.',
       'Erstellung, Zustellung und Verwaltung des Rechnungslebenszyklus.'),
    parent_en='Finance & Billing', owning_unit_en='Finance')

mk_cap('Payment Processing',
    n4('Payment Processing', 'Zahlungsabwicklung'),
    n4('Card processing, refunds and payment reconciliation.',
       'Kartenverarbeitung, Rückerstattungen und Zahlungsabstimmung.'),
    parent_en='Finance & Billing', owning_unit_en='Payment')

mk_cap('Financial Reporting',
    n4('Financial Reporting', 'Finanzberichterstattung'),
    n4('Monthly closing, analytics dashboards and regulatory reporting.',
       'Monatsabschluss, Analyse-Dashboards und regulatorische Berichte.'),
    parent_en='Finance & Billing', owning_unit_en='Finance')

# ── Level 1: Sub-capabilities of Platform & Technology ─────────────────────────
mk_cap('Integration & APIs',
    n4('Integration & APIs', 'Integrationen & APIs'),
    n4('Third-party integrations, webhook management and API gateway.',
       'Drittanbieter-Integrationen, Webhook-Verwaltung und API-Gateway.'),
    parent_en='Platform & Technology', owning_unit_en='Engineering')

mk_cap('Data Platform',
    n4('Data Platform', 'Datenplattform'),
    n4('Data warehouse, ingestion pipelines and analytics infrastructure.',
       'Data Warehouse, Erfassungs-Pipelines und Analyseinfrastruktur.'),
    parent_en='Platform & Technology', owning_unit_en='Engineering')

mk_cap('Identity & Access Management',
    n4('Identity & Access Management', 'Identitäts- und Zugriffsverwaltung'),
    n4('Authentication, authorisation, SSO and user account management.',
       'Authentifizierung, Autorisierung, SSO und Benutzerkontenverwaltung.'),
    parent_en='Platform & Technology', owning_unit_en='Engineering')

# ── Level 1: Sub-capabilities of Compliance & Data Governance ─────────────────
mk_cap('GDPR & Privacy Management',
    n4('GDPR & Privacy Management', 'DSGVO & Datenschutzverwaltung'),
    n4('Processing records, consent management and DPIA workflows.',
       'Verarbeitungsverzeichnis, Einwilligungsverwaltung und DSFA-Prozesse.'),
    parent_en='Compliance & Data Governance', owning_unit_en='Operations')

mk_cap('Data Quality Management',
    n4('Data Quality Management', 'Datenqualitätsverwaltung'),
    n4('Profiling, validation rules and data stewardship workflows.',
       'Profiling, Validierungsregeln und Daten-Stewardship-Prozesse.'),
    parent_en='Compliance & Data Governance', owning_unit_en='Engineering')

# ── Level 2: Sub-capabilities of Data Platform ─────────────────────────────────
mk_cap('Data Ingestion',
    n4('Data Ingestion', 'Datenerfassung'),
    n4('Batch and streaming ingestion from operational systems.',
       'Batch- und Streaming-Erfassung aus Betriebssystemen.'),
    parent_en='Data Platform', owning_unit_en='Engineering')

mk_cap('Data Transformation',
    n4('Data Transformation', 'Datentransformation'),
    n4('ETL/ELT pipelines, data modelling and data mart population.',
       'ETL/ELT-Pipelines, Datenmodellierung und Data-Mart-Befüllung.'),
    parent_en='Data Platform', owning_unit_en='Engineering')

# Link capabilities to processes
cap_proc_links = [
    ('Product Catalogue Management',  ['Search for Product']),
    ('Shopping Cart & Checkout',      ['Add to Cart', 'Checkout', 'Place an Order']),
    ('Order Management',              ['Place an Order', 'Send Order Confirmation']),
    ('Warehouse & Inventory',         ['Pick and Pack']),
    ('Shipping & Returns',            ['Ship Order', 'Pick and Pack']),
    ('Invoice Management',            ['Send Invoice']),
    ('Payment Processing',            ['Process Payment']),
    ('Financial Reporting',           ['Send Invoice', 'Process Payment']),
    ('GDPR & Privacy Management',     ['Customer Registration', 'Confirm Email Address']),
    ('Identity & Access Management',  ['Customer Registration', 'Confirm Email Address']),
    ('Customer Acquisition',          ['Customer Registration']),
    ('Customer Retention',            ['Confirm Email Address']),
]
print('  Linking processes to capabilities...')
for cap_short, proc_names in cap_proc_links:
    cap_key = cap_keys.get(cap_short)
    if not cap_key:
        continue
    proc_key_list = [pk(p) for p in proc_names]
    if proc_key_list:
        api('PUT', f'/capabilities/{cap_key}/linked-processes',
            {'processKeys': proc_key_list}, T)


# ── IT Systems ───────────────────────────────────────────────────────────────────
print('\n[19] IT systems...')

# (en_name, vendor, system_url, names, descriptions, linked_process_en_names, owning_unit_en)
it_system_defs = [
    (
        'Shopify', 'Shopify Inc.',
        'https://admin.shopify.com',
        n4('Shopify', 'Shopify', 'Shopify', 'Shopify', 'Shopify'),
        n4('E-commerce storefront platform for product catalogue, cart and checkout.',
           'E-Commerce-Plattform für Produktkatalog, Warenkorb und Checkout.',
           "Plateforme e-commerce pour le catalogue produits, le panier et le paiement.",
           "Piattaforma e-commerce per catalogo prodotti, carrello e checkout.",
           'Plataforma de comercio electrónico para catálogo, carrito y pago.'),
        ['Search for Product', 'Add to Cart', 'Checkout', 'Place an Order'],
        'Online Shop',
    ),
    (
        'Stripe', 'Stripe Inc.',
        'https://dashboard.stripe.com',
        n4('Stripe', 'Stripe', 'Stripe', 'Stripe', 'Stripe'),
        n4('Payment gateway for card processing, refunds and financial reconciliation.',
           'Zahlungs-Gateway für Kartenabwicklung, Rückerstattungen und Abstimmung.',
           'Passerelle de paiement pour le traitement des cartes et la réconciliation.',
           'Gateway di pagamento per carte, rimborsi e riconciliazione finanziaria.',
           'Pasarela de pago para tarjetas, reembolsos y conciliación financiera.'),
        ['Process Payment', 'Send Invoice'],
        'Payment',
    ),
    (
        'Klaviyo', 'Klaviyo Inc.',
        'https://www.klaviyo.com',
        n4('Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo'),
        n4('Email and SMS marketing automation platform for customer lifecycle campaigns.',
           'E-Mail- und SMS-Marketing-Automatisierung für Kundenkampagnen.',
           "Plateforme d'automatisation marketing email et SMS pour les campagnes clients.",
           'Piattaforma di automazione marketing email e SMS per campagne clienti.',
           'Plataforma de automatización de marketing por email y SMS para campañas.'),
        ['Customer Registration', 'Confirm Email Address'],
        'Marketing',
    ),
    (
        'Manhattan WMS', 'Manhattan Associates',
        'https://manh.com',
        n4('Manhattan WMS', 'Manhattan WMS', 'Manhattan WMS', 'Manhattan WMS', 'Manhattan WMS'),
        n4('Warehouse Management System for stock control, pick/pack and parcel dispatch.',
           'Lagerverwaltungssystem für Bestandskontrolle, Kommissionierung und Paketversand.',
           "Système de gestion d'entrepôt pour le contrôle des stocks et l'expédition.",
           'Sistema di gestione magazzino per controllo scorte, prelievo e spedizione.',
           'Sistema de gestión de almacén para control de stock, picking y expedición.'),
        ['Pick and Pack', 'Ship Order'],
        'Logistics',
    ),
    (
        'SAP S/4HANA', 'SAP SE',
        'https://www.sap.com/products/erp/s4hana.html',
        n4('SAP S/4HANA', 'SAP S/4HANA', 'SAP S/4HANA', 'SAP S/4HANA', 'SAP S/4HANA'),
        n4('Enterprise resource planning system for financial accounting and invoice management.',
           'ERP-System für Finanzbuchhaltung und Rechnungsverwaltung.',
           "Système ERP pour la comptabilité financière et la gestion des factures.",
           'Sistema ERP per contabilità finanziaria e gestione delle fatture.',
           'Sistema ERP para contabilidad financiera y gestión de facturas.'),
        ['Send Invoice'],
        'Finance',
    ),
    (
        'Salesforce CRM', 'Salesforce Inc.',
        'https://www.salesforce.com',
        n4('Salesforce CRM', 'Salesforce CRM', 'Salesforce CRM', 'Salesforce CRM', 'Salesforce CRM'),
        n4('Customer relationship management platform for tracking customer interactions, campaigns and support tickets.',
           'CRM-Plattform für Kundenkontakte, Kampagnen und Support-Tickets.',
           'Plateforme CRM pour le suivi des interactions clients, campagnes et tickets de support.',
           'Piattaforma CRM per il tracciamento delle interazioni clienti, campagne e ticket di supporto.',
           'Plataforma CRM para el seguimiento de interacciones con clientes, campañas y tickets de soporte.'),
        ['Customer Registration', 'Handle Right to Erasure Request'],
        'Marketing',
    ),
    (
        'Workday HCM', 'Workday Inc.',
        'https://www.workday.com',
        n4('Workday HCM', 'Workday HCM', 'Workday HCM', 'Workday HCM', 'Workday HCM'),
        n4('Human capital management system for employee records, payroll, recruitment and onboarding.',
           'Human-Capital-Management-System für Mitarbeiterdaten, Lohnbuchhaltung, Rekrutierung und Einarbeitung.',
           'Système de gestion du capital humain pour les dossiers employés, la paie et le recrutement.',
           'Sistema di gestione delle risorse umane per registri dipendenti, retribuzioni, reclutamento e onboarding.',
           'Sistema de gestión del capital humano para registros de empleados, nóminas, reclutamiento e incorporación.'),
        ['Recruit Employee', 'Onboard Employee'],
        'Human Resources',
    ),
    (
        'Google Analytics 4', 'Google LLC',
        'https://analytics.google.com',
        n4('Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4', 'Google Analytics 4'),
        n4('Web analytics platform for tracking storefront traffic, user journeys and conversion funnels.',
           'Web-Analyseplattform für die Verfolgung von Storefront-Traffic, Nutzerreisen und Conversion-Funnels.',
           "Plateforme d'analyse web pour le trafic de la boutique, les parcours utilisateurs et les entonnoirs de conversion.",
           "Piattaforma di analisi web per il traffico dello storefront, i percorsi degli utenti e i funnel di conversione.",
           'Plataforma de analítica web para el tráfico de la tienda, los recorridos de los usuarios y los embudos de conversión.'),
        ['Search for Product', 'Place an Order'],
        'Marketing',
    ),
    (
        'Zendesk', 'Zendesk Inc.',
        'https://www.zendesk.com',
        n4('Zendesk', 'Zendesk', 'Zendesk', 'Zendesk', 'Zendesk'),
        n4('Customer support ticketing and helpdesk platform for handling customer inquiries and complaints.',
           'Kunden-Support-Ticketing und Helpdesk-Plattform für Kundenanfragen und Beschwerden.',
           "Plateforme de ticketing et helpdesk pour la gestion des demandes et réclamations clients.",
           'Piattaforma di ticketing e helpdesk per la gestione delle richieste e reclami dei clienti.',
           'Plataforma de tickets de soporte y helpdesk para gestionar consultas y reclamaciones de clientes.'),
        ['Customer Registration', 'Handle Right to Erasure Request'],
        'Operations',
    ),
]

it_system_keys = {}
for (short_name, vendor, url, nms, descs, linked_procs, owning_unit_en) in it_system_defs:
    owning_unit_key = ou_keys.get(owning_unit_en) if owning_unit_en else None
    result = api('POST', '/it-systems', {
        'names': nms, 'descriptions': descs,
        'vendor': vendor, 'systemUrl': url,
        **({'owningUnitKey': owning_unit_key} if owning_unit_key else {}),
    }, T)
    if '_error' not in result:
        isk = result['key']
        it_system_keys[short_name] = isk
        if linked_procs:
            proc_keys = [pk(p) for p in linked_procs]
            ok(f'{short_name} linked processes',
               api('PUT', f'/it-systems/{isk}/linked-processes',
                   {'processKeys': proc_keys}, T))
        ok(f'IT system: {short_name} (vendor={vendor})', result)
    else:
        it_system_keys[short_name] = short_name.lower().replace(' ', '-').replace('/', '-')


# ── External Org Units ────────────────────────────────────────────────────────────
print('\n[20] External org units (body leasing)...')

logistics_key = ou_keys.get('Logistics', 'logistics')
payment_key   = ou_keys.get('Payment', 'payment')

# Mark Logistics as an external unit (body-leased to DHL)
if '_error' not in dhl:
    ok('Logistics → external (DHL Logistics GmbH)',
       api('PUT', f'/organisational-units/{logistics_key}/external-fields', {
           'isExternal': True,
           'externalCompanyName': 'DHL Logistics GmbH',
           'countryOfExecution': 'DE',
       }, T))
    # DHL team reads Order and Parcel, writes (manipulates) Parcel
    ok('Logistics data access entities',
       api('PUT', f'/organisational-units/{logistics_key}/data-access-entities',
           {'entityKeys': [ek('Order'), ek('Parcel')]}, T))
    ok('Logistics data manipulation entities',
       api('PUT', f'/organisational-units/{logistics_key}/data-manipulation-entities',
           {'entityKeys': [ek('Parcel')]}, T))
else:
    print('  SKIP external org unit (DHL data processor not created)')

# Mark Payment as an external unit (outsourced payment operations team)
if '_error' not in stripe:
    ok('Payment → external (Stripe Managed Services)',
       api('PUT', f'/organisational-units/{payment_key}/external-fields', {
           'isExternal': True,
           'externalCompanyName': 'Stripe Managed Services Ltd.',
           'countryOfExecution': 'IE',
       }, T))
    # Payment team reads Invoice, writes Payment Transaction
    ok('Payment data access entities',
       api('PUT', f'/organisational-units/{payment_key}/data-access-entities',
           {'entityKeys': [ek('Invoice')]}, T))
    ok('Payment data manipulation entities',
       api('PUT', f'/organisational-units/{payment_key}/data-manipulation-entities',
           {'entityKeys': [ek('Payment Transaction')]}, T))
else:
    print('  SKIP external org unit (Stripe data processor not created)')


# ── DPIAs ───────────────────────────────────────────────────────────────────────
print('\n[21] DPIAs...')

# Trigger DPIAs on privacy-sensitive processes (those with personal data)
# (process_en_name, initial_risk, residual_risk, risk_description, measures)
dpia_defs = [
    (
        'Customer Registration',
        'HIGH', 'MEDIUM',
        'Collects PII (name, email, address) and creates a persistent user account. '
        'Risk of data breach if account credentials are compromised.',
        'Enforce strong password policy and MFA. Encrypt PII at rest and in transit. '
        'Limit data retention to active account lifetime plus statutory periods.',
    ),
    (
        'Process Payment',
        'HIGH', 'LOW',
        'Processes card data and financial PII. Risk of financial fraud and PCI-DSS non-compliance.',
        'All card data handled exclusively by PCI-DSS compliant processor (Stripe). '
        'No card numbers stored in own systems. Tokenisation in place.',
    ),
    (
        'Confirm Email Address',
        'MEDIUM', 'LOW',
        'Sends email with verification token to user email address. '
        'Risk of phishing if token sent to unverified address.',
        'One-time token with 24h expiry. SMTP transport encrypted. '
        'Token invalidated after first use.',
    ),
    (
        'Send Invoice',
        'MEDIUM', 'MEDIUM',
        'Processes financial PII (billing address, VAT ID) and sends to external email. '
        'Risk of invoice interception or delivery to wrong address.',
        'Verify email address before sending. Use encrypted SMTP. '
        'Retain invoices for statutory period (10 years AT/DE).',
    ),
    (
        'Recruit Employee',
        'HIGH', 'MEDIUM',
        'Processes applicant PII including CV data, interview notes and potentially health or criminal record information. '
        'Risk of unlawful retention of unsuccessful applicant data beyond the statutory period.',
        'Strict 6-month retention policy for rejected applicants. '
        'Role-based access limited to HR and hiring manager. '
        'Background checks handled by accredited third-party provider only.',
    ),
    (
        'Handle Right to Erasure Request',
        'HIGH', 'LOW',
        'Accesses personal data across multiple systems to execute deletion. '
        'Risk of incomplete erasure if downstream systems are not notified, or of unlawful deletion if legal hold applies.',
        'Automated deletion workflow with cross-system confirmation receipts. '
        'Legal-hold check against fiscal and commercial retention schedules before any deletion. '
        'Full audit trail retained for 5 years after erasure event.',
    ),
]

for (proc_name, initial_risk, residual_risk, risk_desc, measures) in dpia_defs:
    proc_key = pk(proc_name)
    # Trigger the DPIA
    dpia_result = api('POST', f'/processes/{proc_key}/dpia', {}, T)
    if '_error' not in dpia_result and dpia_result.get('key'):
        dpia_key = dpia_result['key']
        # Set risk description and measures
        api('PUT', f'/dpia/{dpia_key}/risk-description',
            {'riskDescription': risk_desc}, T)
        api('PUT', f'/dpia/{dpia_key}/measures',
            {'measures': measures}, T)
        # Set initial and residual risk
        ok(f'DPIA: {proc_name}',
           api('PUT', f'/dpia/{dpia_key}/residual-risk', {
               'initialRisk': initial_risk,
               'residualRisk': residual_risk,
           }, T))
    else:
        print(f'  SKIP DPIA for {proc_name} (process not found or DPIA already exists)')


# ── Computed owners (clear explicit overrides) ───────────────────────────────────
# These entities/processes are in bounded contexts whose owning unit has a business owner.
# Clearing the explicit override lets the owner be computed from the owning unit.
print('\n[22] Computed owners (clear explicit overrides where owning unit provides owner)...')

# Bounded contexts by domain; owning units are set in [18b] via the capabilities/org-unit assignments.
# We clear the override for entities and top-level processes that belong to org-unit-owned contexts.

# Entities whose owner should be computed from their bounded context's owning unit:
# - Product, Product Category, Product Review, Shopping Cart, Order, Order Line Item → Sales BC (owned by Online Shop → sarah.mitchell)
# - Invoice, Payment Transaction → Billing BC (owned by Finance → tom.wagner)
# - Parcel → Warehouse BC (owned by Supply Chain → marco.rossi)
# - Customer, Billing Address, Shipping Address, Full Name, Date of Birth → Customer Care BC (owned by Online Shop/Operations → lisa.chen)
computed_entities = [
    'product', 'product-category', 'product-review', 'shopping-cart',
    'order', 'order-line-item', 'invoice', 'payment-transaction', 'parcel',
    'natural-person',
]
for ekey in computed_entities:
    r = api('DELETE', f'/business-entities/{ekey}/data-owner', token=T)
    if '_error' not in r:
        print(f'  ok  computed owner: {ekey}')

# Top-level processes whose owner should be computed from bounded context owning unit:
computed_processes = [
    'place-an-order', 'checkout', 'search-for-product', 'add-to-cart',
    'ship-order', 'pick-and-pack',
    'send-invoice', 'process-payment',
    'recruit-employee', 'onboard-employee',
]
for pkey in computed_processes:
    r = api('DELETE', f'/processes/{pkey}/owner', token=T)
    if '_error' not in r:
        print(f'  ok  computed owner: {pkey}')

# ── Summary ─────────────────────────────────────────────────────────────────────
print('\n' + '=' * 60)
if errors:
    print(f'Completed with {len(errors)} error(s):')
    for e in errors:
        print(f'  ! {e}')
else:
    print('All done — no errors!')
print(f'\nDemo users:')
for (username, first, last, email, role) in user_defs:
    print(f'  {email}  /  password: {DEMO_PASSWORD}  ({role})')
print(f'\nOpen http://localhost:3000')
