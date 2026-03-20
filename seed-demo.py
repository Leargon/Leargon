"""
seed-demo.py — Reset and seed the Léargon e-commerce demo.

Phase 1 (WIPE): Deletes all business data + non-admin users in safe FK order:
  classifications → processes → entities → domains → org units → users

Phase 2 (SEED): Creates fresh e-commerce demo data:
  locales · users · classifications · org units (+ hierarchy + leads) · domains
  (+ types + vision statements) · entities (+ bounded-contexts + data owners + interfaces) ·
  processes (+ hierarchy + bounded-contexts + owners + executing units) ·
  relationships · classification assignments · field configurations (mandatory fields) ·
  data processors (Art. 9 revDSG) · cross-border transfers (Art. 16-17 revDSG) ·
  context relationships · domain events (+ consumers + process links) · translation links

Usage:
  python3 seed-demo.py
"""
import urllib.request, json, sys

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


print('\n[0/6] Data processors...')
wipe('data processors', '/data-processors', lambda k: f'/data-processors/{k}')

print('\n[1/6] Classifications...')
wipe('classifications', '/classifications',
     lambda k: f'/classifications/{k}')

print('[2/6] Processes (clear diagrams, deepest children first)...')
processes = api('GET', '/processes', token=T)
if isinstance(processes, list):
    minimal_diagram = {
        'elements': [
            {'elementId': 'wipe-start', 'elementType': 'NONE_START_EVENT', 'sortOrder': 0},
            {'elementId': 'wipe-end',   'elementType': 'NONE_END_EVENT',   'sortOrder': 1},
        ],
        'flows': [{'flowId': 'wipe-flow', 'sourceElementId': 'wipe-start', 'targetElementId': 'wipe-end'}],
    }
    for p in processes:
        api('PUT', f'/processes/{p["key"]}/diagram', minimal_diagram, T)
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

print('[3/6] Business entities (children first)...')
wipe('entities', '/business-entities',
     lambda k: f'/business-entities/{k}',
     sort_key=lambda e: -e['key'].count('.'))

print('[4/6] Business domains (children first)...')
wipe('domains', '/business-domains',
     lambda k: f'/business-domains/{k}',
     sort_key=lambda d: -d['key'].count('.'))

print('[5/6] Organisational units...')
wipe('org units', '/organisational-units',
     lambda k: f'/organisational-units/{k}',
     sort_key=lambda o: -o['key'].count('.'))

print('[6/6] Non-admin users...')
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
    {
        'assignableTo': 'BUSINESS_ENTITY',
        'names': n4('Personal Data', 'Personenbezogene Daten', 'Donnees personnelles', 'Dati personali', 'Datos personales'),
        'values': [
            {'key': 'PD', 'names': n4('Personal Data', 'Personenbezogene Daten', 'Donnees personnelles', 'Dati personali', 'Datos personales')},
            {'key': 'SPD', 'names': n4('Special Category', 'Besondere Kategorie', 'Categorie speciale', 'Categoria speciale', 'Categoría especial')},
        ],
    },
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

S   = classif_keys.get('Sensitivity',                    'sensitivity')
DC  = classif_keys.get('Data Criticality',               'data-criticality')
PD  = classif_keys.get('Personal Data',                  'personal-data')
PP  = classif_keys.get('Process Priority',               'process-priority')


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
     None),

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
            api('PUT', f'/organisational-units/{ouk}/lead', {'leadUsername': lead}, T)
        ok(f'{en_name} (type={unit_type}' + (f', lead={lead})' if lead else ')'), result)
    else:
        ou_keys[en_name] = en_name.lower().replace(' ', '-')

# Set org unit parent hierarchy
ou_parents = {
    'Marketing':   'Online Shop',
    'Operations':  'Online Shop',
    'Logistics':   'Supply Chain',
    'Payment':     'Finance',
}
print('  Setting org unit hierarchy...')
for child_en, parent_en in ou_parents.items():
    child_key  = ou_keys.get(child_en,  child_en.lower().replace(' ', '-'))
    parent_key = ou_keys.get(parent_en, parent_en.lower().replace(' ', '-'))
    ok(f'  {child_key} -> {parent_key}',
       api('PUT', f'/organisational-units/{child_key}/parents', {'keys': [parent_key]}, T))


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
        ok(f'{en_name} (type={domain_type})', result)
    else:
        domain_keys[en_name] = en_name.lower().replace(' ', '-')

def dk(en_name):
    return domain_keys.get(en_name, en_name.lower().replace(' ', '-'))

def bck(en_name):
    """Default bounded context key for a domain: {domainKey}/default"""
    return dk(en_name) + '/default'


# ── 6. Business entities ────────────────────────────────────────────────────────
print('\n[6/9] Business entities...')

# (en_name, parent_en, domain_en, names, descriptions, data_owner_username)
entity_data = [
    ('Natural Person', None, 'Customer Care',
     n4('Natural Person', 'Natürliche Person', 'Personne physique', 'Persona fisica', 'Persona física'),
     n4('A human individual with legal capacity. Acts as the shared base identity for customers and employees.',
        'Eine natürliche Person mit Rechtshandlungsfähigkeit. Gemeinsame Basisidentität für Kunden und Mitarbeiter.',
        'Personne physique avec capacite juridique. Identite de base partagee entre clients et employes.',
        'Persona fisica con capacita giuridica. Identita base condivisa tra clienti e dipendenti.',
        'Persona física con capacidad jurídica. Identidad base compartida entre clientes y empleados.'),
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


# ── 7. Entity interfaces ────────────────────────────────────────────────────────
print('\n[7/9] Entity interfaces...')
np = ek('Natural Person')
for entity_en in ('Customer', 'Employee'):
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
]

# Legal basis per process (Art. 6 GDPR / Art. 31 revDSG)
process_legal_basis = {
    'Customer Registration':    'CONTRACT',
    'Validate Customer Data':   'CONTRACT',
    'Confirm Email Address':    'CONTRACT',
    'Place an Order':           'CONTRACT',
    'Search for Product':       'CONTRACT',
    'Add to Cart':              'CONTRACT',
    'Checkout':                 'CONTRACT',
    'Validate Shipping Address':'CONTRACT',
    'Process Payment':          'CONTRACT',
    'Send Invoice':             'LEGAL_OBLIGATION',
    'Ship Order':               'CONTRACT',
    'Pick and Pack':            'CONTRACT',
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
assign('business-entities', ek('Billing Address'),   [(S, 'C3'), (DC, 'important'), (PD, 'PD')])
assign('business-entities', ek('Shipping Address'),  [(S, 'C3'), (DC, 'important'), (PD, 'PD')])
assign('business-entities', ek('Full Name'),         [(S, 'C3'), (DC, 'important'), (PD, 'PD')])
assign('business-entities', ek('Employee'),          [(S, 'C4'), (DC, 'important')])
assign('business-entities', ek('Payment Transaction'),[(S, 'C4'), (DC, 'critical')])
assign('business-entities', ek('Date of Birth'),     [(S, 'C4'), (DC, 'important'), (PD, 'SPD')])

print('  Process classifications:')
for proc_en, prio in [
    ('Place an Order',         'critical'),
    ('Checkout',               'critical'),
    ('Process Payment',        'critical'),
    ('Customer Registration',  'high'),
    ('Confirm Email Address',  'high'),
    ('Pick and Pack',          'high'),
    ('Send Invoice',           'high'),
    ('Ship Order',             'high'),
    ('Validate Customer Data', 'medium'),
    ('Validate Shipping Address','medium'),
    ('Search for Product',     'medium'),
    ('Add to Cart',            'medium'),
]:
    assign('processes', pk(proc_en), [(PP, prio)])


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


# ── Data Processors & Cross-border Transfers ─────────────────────────────────────
print('\n[15] Data processors & cross-border transfers...')

stripe = api('POST', '/data-processors', {
    'names': n4('Stripe', 'Stripe', 'Stripe', 'Stripe', 'Stripe'),
    'processingCountries': ['US', 'IE'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
}, T)
ok('data processor: Stripe', stripe)

klaviyo = api('POST', '/data-processors', {
    'names': n4('Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo', 'Klaviyo'),
    'processingCountries': ['US'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': False,
}, T)
ok('data processor: Klaviyo', klaviyo)

dhl = api('POST', '/data-processors', {
    'names': n4('DHL Express', 'DHL Express', 'DHL Express', 'DHL Express', 'DHL Express'),
    'processingCountries': ['DE', 'NL'],
    'processorAgreementInPlace': True,
    'subProcessorsApproved': True,
}, T)
ok('data processor: DHL Express', dhl)

# Link entities to processors
if '_error' not in stripe:
    ok('link Payment Transaction → Stripe',
       api('PUT', f'/data-processors/{stripe["key"]}/linked-entities',
           {'businessEntityKeys': [ek('Payment Transaction')]}, T))

if '_error' not in klaviyo:
    ok('link Customer → Klaviyo',
       api('PUT', f'/data-processors/{klaviyo["key"]}/linked-entities',
           {'businessEntityKeys': [ek('Customer')]}, T))

if '_error' not in dhl:
    ok('link Parcel → DHL Express',
       api('PUT', f'/data-processors/{dhl["key"]}/linked-entities',
           {'businessEntityKeys': [ek('Parcel')]}, T))

# Link processes to processors
if '_error' not in stripe:
    ok('link Process Payment → Stripe',
       api('PUT', f'/data-processors/{stripe["key"]}/linked-processes',
           {'processKeys': [pk('Process Payment')]}, T))

if '_error' not in klaviyo:
    ok('link Customer Registration + Confirm Email → Klaviyo',
       api('PUT', f'/data-processors/{klaviyo["key"]}/linked-processes',
           {'processKeys': [pk('Customer Registration'), pk('Confirm Email Address')]}, T))

if '_error' not in dhl:
    ok('link Ship Order → DHL Express',
       api('PUT', f'/data-processors/{dhl["key"]}/linked-processes',
           {'processKeys': [pk('Ship Order')]}, T))

# Cross-border transfers on entities (Art. 16-17 revDSG)
ok('cross-border transfers: Customer',
   api('PUT', f'/business-entities/{ek("Customer")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Email marketing service via Klaviyo (US-based)'},
       ]}, T))

ok('cross-border transfers: Payment Transaction',
   api('PUT', f'/business-entities/{ek("Payment Transaction")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'US', 'safeguard': 'STANDARD_CONTRACTUAL_CLAUSES',
            'notes': 'Payment processing via Stripe (US-based)'},
           {'destinationCountry': 'IE', 'safeguard': 'ADEQUACY_DECISION',
            'notes': 'Stripe European operations (Ireland, EU adequacy)'},
       ]}, T))

ok('cross-border transfers: Parcel',
   api('PUT', f'/business-entities/{ek("Parcel")}/cross-border-transfers',
       {'transfers': [
           {'destinationCountry': 'DE', 'safeguard': 'ADEQUACY_DECISION',
            'notes': 'DHL Express logistics operations (Germany, EU adequacy)'},
       ]}, T))

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
            'notes': 'Email verification service via Klaviyo (US)'},
       ]}, T))


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
    ('PaymentProcessed', 'Billing',
     ['Sales'],
     [('Process Payment', 'TRIGGERS')],
     'Raised when a payment is successfully processed. Allows Sales to confirm the order and proceed to fulfilment.'),
    ('OrderShipped', 'Shipping',
     ['Sales', 'Customer Care'],
     [('Ship Order', 'TRIGGERS')],
     'Raised when a parcel is dispatched to the carrier. Notifies Sales to mark the order as shipped and Customer Care to trigger delivery notifications.'),
    ('CustomerRegistered', 'Customer Care',
     ['Marketing', 'Sales'],
     [('Customer Registration', 'TRIGGERS')],
     'Raised when a new customer account is created. Allows Marketing to trigger a welcome campaign and Sales to enable personalised recommendations.'),
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
