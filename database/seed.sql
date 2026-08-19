-- AI SecureIoT Field Sales Platform
-- Demo / Seed Data
-- Project Owner: Amare Seneshaw
-- All organizations and people in this file are fictional.

BEGIN;

-- =========================================================
-- ROLES
-- =========================================================

INSERT INTO roles (role_name, description) VALUES
('SYSTEM_ADMIN', 'Full platform administration'),
('SALES_MANAGER', 'Sales team and pipeline management'),
('FIELD_SALES', 'Customer, field visit, and opportunity management'),
('SECURITY_ADMIN', 'Security events and access-control management'),
('TECHNICIAN', 'Assigned sites, devices, and service information');

-- =========================================================
-- PERMISSIONS
-- =========================================================

INSERT INTO permissions (permission_name, description) VALUES
('customer.read', 'View customer information'),
('customer.create', 'Create customers'),
('customer.update', 'Update customers'),
('opportunity.read', 'View opportunities'),
('opportunity.create', 'Create opportunities'),
('opportunity.update', 'Update opportunities'),
('field_visit.create', 'Create field visits'),
('device.read', 'View IoT devices'),
('device.update', 'Update IoT devices'),
('access_event.read', 'View access-control events'),
('audit_log.read', 'View audit logs'),
('user.manage', 'Manage platform users');

-- =========================================================
-- USERS
-- =========================================================

-- Demo password hashes only.
-- These are placeholders for development and are NOT real passwords.

INSERT INTO users
(username, email, password_hash, first_name, last_name, phone, status)
VALUES
(
    'admin_demo',
    'admin@example.invalid',
    'DEMO_HASH_ADMIN',
    'Jordan',
    'Reed',
    '555-0101',
    'ACTIVE'
),
(
    'sales_manager_demo',
    'sales.manager@example.invalid',
    'DEMO_HASH_MANAGER',
    'Taylor',
    'Morgan',
    '555-0102',
    'ACTIVE'
),
(
    'field_sales_demo',
    'field.sales@example.invalid',
    'DEMO_HASH_SALES',
    'Casey',
    'Brooks',
    '555-0103',
    'ACTIVE'
),
(
    'security_admin_demo',
    'security@example.invalid',
    'DEMO_HASH_SECURITY',
    'Morgan',
    'Lee',
    '555-0104',
    'ACTIVE'
),
(
    'technician_demo',
    'technician@example.invalid',
    'DEMO_HASH_TECH',
    'Alex',
    'Parker',
    '555-0105',
    'ACTIVE'
);

-- =========================================================
-- USER ROLES
-- =========================================================

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
    u.user_id,
    r.role_id,
    u.user_id
FROM users u
JOIN roles r ON
    (u.username = 'admin_demo' AND r.role_name = 'SYSTEM_ADMIN')
 OR (u.username = 'sales_manager_demo' AND r.role_name = 'SALES_MANAGER')
 OR (u.username = 'field_sales_demo' AND r.role_name = 'FIELD_SALES')
 OR (u.username = 'security_admin_demo' AND r.role_name = 'SECURITY_ADMIN')
 OR (u.username = 'technician_demo' AND r.role_name = 'TECHNICIAN');

-- =========================================================
-- ROLE PERMISSIONS
-- =========================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'SYSTEM_ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'customer.read',
    'customer.create',
    'customer.update',
    'opportunity.read',
    'opportunity.create',
    'opportunity.update',
    'field_visit.create'
)
WHERE r.role_name = 'SALES_MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'customer.read',
    'customer.create',
    'customer.update',
    'opportunity.read',
    'opportunity.create',
    'opportunity.update',
    'field_visit.create'
)
WHERE r.role_name = 'FIELD_SALES';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'device.read',
    'device.update',
    'access_event.read'
)
WHERE r.role_name = 'SECURITY_ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'device.read',
    'device.update'
)
WHERE r.role_name = 'TECHNICIAN';

-- =========================================================
-- CUSTOMERS
-- =========================================================

INSERT INTO customers
(
    company_name,
    industry,
    employee_count,
    account_status,
    primary_phone,
    primary_email,
    website,
    address,
    city,
    state,
    postal_code,
    country,
    account_owner_id
)
VALUES
(
    'Northstar Manufacturing',
    'Manufacturing',
    620,
    'ACTIVE',
    '555-1001',
    'security@northstar.example.invalid',
    'https://example.invalid/northstar',
    '100 Industrial Parkway',
    'Atlanta',
    'GA',
    '30301',
    'USA',
    3
),
(
    'Pinecrest Business Center',
    'Commercial Real Estate',
    280,
    'ACTIVE',
    '555-1002',
    'facilities@pinecrest.example.invalid',
    'https://example.invalid/pinecrest',
    '200 Peachtree Business Way',
    'Atlanta',
    'GA',
    '30303',
    'USA',
    3
),
(
    'Summit Distribution Group',
    'Logistics',
    410,
    'ACTIVE',
    '555-1003',
    'operations@summit.example.invalid',
    'https://example.invalid/summit',
    '300 Logistics Drive',
    'Marietta',
    'GA',
    '30060',
    'USA',
    3
);

-- =========================================================
-- CONTACTS
-- =========================================================

INSERT INTO contacts
(
    customer_id,
    first_name,
    last_name,
    job_title,
    email,
    phone,
    contact_type,
    is_primary
)
SELECT
    customer_id,
    'Jordan',
    'Carter',
    'Facilities Director',
    'jordan.carter@northstar.example.invalid',
    '555-2001',
    'Facilities',
    TRUE
FROM customers
WHERE company_name = 'Northstar Manufacturing';

INSERT INTO contacts
(
    customer_id,
    first_name,
    last_name,
    job_title,
    email,
    phone,
    contact_type,
    is_primary
)
SELECT
    customer_id,
    'Riley',
    'Johnson',
    'Property Manager',
    'riley.johnson@pinecrest.example.invalid',
    '555-2002',
    'Operations',
    TRUE
FROM customers
WHERE company_name = 'Pinecrest Business Center';

INSERT INTO contacts
(
    customer_id,
    first_name,
    last_name,
    job_title,
    email,
    phone,
    contact_type,
    is_primary
)
SELECT
    customer_id,
    'Avery',
    'Williams',
    'Operations Manager',
    'avery.williams@summit.example.invalid',
    '555-2003',
    'Operations',
    TRUE
FROM customers
WHERE company_name = 'Summit Distribution Group';

-- =========================================================
-- SITES
-- =========================================================

INSERT INTO sites
(
    customer_id,
    site_name,
    site_type,
    address,
    city,
    state,
    postal_code,
    country,
    latitude,
    longitude,
    status,
    assigned_technician_id
)
SELECT
    customer_id,
    'Northstar Main Facility',
    'Manufacturing Facility',
    '100 Industrial Parkway',
    'Atlanta',
    'GA',
    '30301',
    'USA',
    33.7490,
    -84.3880,
    'ACTIVE',
    5
FROM customers
WHERE company_name = 'Northstar Manufacturing';

INSERT INTO sites
(
    customer_id,
    site_name,
    site_type,
    address,
    city,
    state,
    postal_code,
    country,
    latitude,
    longitude,
    status,
    assigned_technician_id
)
SELECT
    customer_id,
    'Pinecrest Tower',
    'Office Building',
    '200 Peachtree Business Way',
    'Atlanta',
    'GA',
    '30303',
    'USA',
    33.7550,
    -84.3900,
    'ACTIVE',
    5
FROM customers
WHERE company_name = 'Pinecrest Business Center';

INSERT INTO sites
(
    customer_id,
    site_name,
    site_type,
    address,
    city,
    state,
    postal_code,
    country,
    latitude,
    longitude,
    status,
    assigned_technician_id
)
SELECT
    customer_id,
    'Summit Distribution Center',
    'Distribution Center',
    '300 Logistics Drive',
    'Marietta',
    'GA',
    '30060',
    'USA',
    33.9526,
    -84.5499,
    'ACTIVE',
    5
FROM customers
WHERE company_name = 'Summit Distribution Group';

-- =========================================================
-- BUILDINGS
-- =========================================================

INSERT INTO buildings
(
    site_id,
    building_name,
    building_type,
    floor_count,
    description
)
SELECT
    site_id,
    'Main Production Building',
    'Industrial',
    2,
    'Primary manufacturing and administrative building'
FROM sites
WHERE site_name = 'Northstar Main Facility';

INSERT INTO buildings
(
    site_id,
    building_name,
    building_type,
    floor_count,
    description
)
SELECT
    site_id,
    'Tower Building',
    'Commercial',
    8,
    'Multi-tenant office building'
FROM sites
WHERE site_name = 'Pinecrest Tower';

INSERT INTO buildings
(
    site_id,
    building_name,
    building_type,
    floor_count,
    description
)
SELECT
    site_id,
    'Distribution Warehouse',
    'Warehouse',
    1,
    'Primary logistics warehouse'
FROM sites
WHERE site_name = 'Summit Distribution Center';

-- =========================================================
-- CONTROLLERS
-- =========================================================

INSERT INTO controllers
(
    site_id,
    controller_name,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    ip_address,
    status,
    last_seen_at
)
SELECT
    site_id,
    'Northstar Controller 01',
    'DemoSecure',
    'ASC-2000',
    'DEMO-CTRL-001',
    '2.4.1',
    '10.10.1.10',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Northstar Main Facility';

INSERT INTO controllers
(
    site_id,
    controller_name,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    ip_address,
    status,
    last_seen_at
)
SELECT
    site_id,
    'Pinecrest Controller 01',
    'DemoSecure',
    'ASC-2000',
    'DEMO-CTRL-002',
    '2.4.1',
    '10.20.1.10',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Pinecrest Tower';

INSERT INTO controllers
(
    site_id,
    controller_name,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    ip_address,
    status,
    last_seen_at
)
SELECT
    site_id,
    'Summit Controller 01',
    'DemoSecure',
    'ASC-2000',
    'DEMO-CTRL-003',
    '2.4.1',
    '10.30.1.10',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Summit Distribution Center';

-- =========================================================
-- DOORS
-- =========================================================

INSERT INTO doors
(
    building_id,
    door_name,
    door_type,
    location_description,
    status,
    controller_id
)
SELECT
    b.building_id,
    'Main Entrance',
    'Main Entrance',
    'Front employee entrance',
    'SECURE',
    c.controller_id
FROM buildings b
JOIN sites s ON s.site_id = b.site_id
JOIN controllers c ON c.site_id = s.site_id
WHERE b.building_name = 'Main Production Building';

INSERT INTO doors
(
    building_id,
    door_name,
    door_type,
    location_description,
    status,
    controller_id
)
SELECT
    b.building_id,
    'Server Room',
    'Restricted Area',
    'Restricted technical area',
    'SECURE',
    c.controller_id
FROM buildings b
JOIN sites s ON s.site_id = b.site_id
JOIN controllers c ON c.site_id = s.site_id
WHERE b.building_name = 'Main Production Building';

INSERT INTO doors
(
    building_id,
    door_name,
    door_type,
    location_description,
    status,
    controller_id
)
SELECT
    b.building_id,
    'Lobby Entrance',
    'Main Entrance',
    'Main office lobby',
    'SECURE',
    c.controller_id
FROM buildings b
JOIN sites s ON s.site_id = b.site_id
JOIN controllers c ON c.site_id = s.site_id
WHERE b.building_name = 'Tower Building';

INSERT INTO doors
(
    building_id,
    door_name,
    door_type,
    location_description,
    status,
    controller_id
)
SELECT
    b.building_id,
    'Warehouse Entrance',
    'Warehouse',
    'Primary warehouse entrance',
    'SECURE',
    c.controller_id
FROM buildings b
JOIN sites s ON s.site_id = b.site_id
JOIN controllers c ON c.site_id = s.site_id
WHERE b.building_name = 'Distribution Warehouse';

-- =========================================================
-- READERS
-- =========================================================

INSERT INTO readers
(
    door_id,
    reader_name,
    reader_type,
    manufacturer,
    model,
    serial_number,
    status,
    last_seen_at
)
SELECT
    d.door_id,
    'Northstar Reader 01',
    'RFID',
    'DemoSecure',
    'RF-100',
    'DEMO-RDR-001',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM doors d
JOIN buildings b ON b.building_id = d.building_id
WHERE b.building_name = 'Main Production Building'
AND d.door_name = 'Main Entrance';

INSERT INTO readers
(
    door_id,
    reader_name,
    reader_type,
    manufacturer,
    model,
    serial_number,
    status,
    last_seen_at
)
SELECT
    d.door_id,
    'Northstar Reader 02',
    'RFID',
    'DemoSecure',
    'RF-100',
    'DEMO-RDR-002',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM doors d
JOIN buildings b ON b.building_id = d.building_id
WHERE b.building_name = 'Main Production Building'
AND d.door_name = 'Server Room';

INSERT INTO readers
(
    door_id,
    reader_name,
    reader_type,
    manufacturer,
    model,
    serial_number,
    status,
    last_seen_at
)
SELECT
    d.door_id,
    'Pinecrest Reader 01',
    'RFID',
    'DemoSecure',
    'RF-100',
    'DEMO-RDR-003',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM doors d
JOIN buildings b ON b.building_id = d.building_id
WHERE b.building_name = 'Tower Building'
AND d.door_name = 'Lobby Entrance';

INSERT INTO readers
(
    door_id,
    reader_name,
    reader_type,
    manufacturer,
    model,
    serial_number,
    status,
    last_seen_at
)
SELECT
    d.door_id,
    'Summit Reader 01',
    'RFID',
    'DemoSecure',
    'RF-100',
    'DEMO-RDR-004',
    'ONLINE',
    CURRENT_TIMESTAMP
FROM doors d
JOIN buildings b ON b.building_id = d.building_id
WHERE b.building_name = 'Distribution Warehouse'
AND d.door_name = 'Warehouse Entrance';

-- =========================================================
-- CREDENTIALS
-- =========================================================

INSERT INTO credentials
(
    credential_type,
    credential_identifier,
    status,
    issued_to_user_id,
    issued_at
)
SELECT
    'RFID_CARD',
    'CARD-DEMO-001',
    'ACTIVE',
    user_id,
    CURRENT_TIMESTAMP
FROM users
WHERE username = 'field_sales_demo';

INSERT INTO credentials
(
    credential_type,
    credential_identifier,
    status,
    issued_to_user_id,
    issued_at
)
SELECT
    'RFID_CARD',
    'CARD-DEMO-002',
    'ACTIVE',
    user_id,
    CURRENT_TIMESTAMP
FROM users
WHERE username = 'technician_demo';

-- =========================================================
-- IoT DEVICES
-- =========================================================

INSERT INTO devices
(
    site_id,
    device_name,
    device_type,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    status,
    health_status,
    last_seen_at,
    installed_at
)
SELECT
    site_id,
    'Northstar Motion Sensor 01',
    'MOTION_SENSOR',
    'DemoIoT',
    'MS-100',
    'DEMO-IOT-001',
    '1.2.0',
    'ONLINE',
    'HEALTHY',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Northstar Main Facility';

INSERT INTO devices
(
    site_id,
    device_name,
    device_type,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    status,
    health_status,
    last_seen_at,
    installed_at
)
SELECT
    site_id,
    'Northstar Temperature Sensor 01',
    'TEMPERATURE_SENSOR',
    'DemoIoT',
    'TS-100',
    'DEMO-IOT-002',
    '1.1.0',
    'ONLINE',
    'HEALTHY',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Northstar Main Facility';

INSERT INTO devices
(
    site_id,
    device_name,
    device_type,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    status,
    health_status,
    last_seen_at,
    installed_at
)
SELECT
    site_id,
    'Pinecrest Occupancy Sensor 01',
    'OCCUPANCY_SENSOR',
    'DemoIoT',
    'OS-100',
    'DEMO-IOT-003',
    '1.4.0',
    'ONLINE',
    'HEALTHY',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Pinecrest Tower';

INSERT INTO devices
(
    site_id,
    device_name,
    device_type,
    manufacturer,
    model,
    serial_number,
    firmware_version,
    status,
    health_status,
    last_seen_at,
    installed_at
)
SELECT
    site_id,
    'Summit Door Sensor 01',
    'DOOR_SENSOR',
    'DemoIoT',
    'DS-100',
    'DEMO-IOT-004',
    '1.0.5',
    'ONLINE',
    'HEALTHY',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM sites
WHERE site_name = 'Summit Distribution Center';

-- =========================================================
-- DEVICE TELEMETRY
-- =========================================================

INSERT INTO device_telemetry
(device_id, timestamp, metric_name, metric_value, unit, quality)
SELECT
    device_id,
    CURRENT_TIMESTAMP,
    'temperature',
    72.4,
    'F',
    'GOOD'
FROM devices
WHERE serial_number = 'DEMO-IOT-002';

INSERT INTO device_telemetry
(device_id, timestamp, metric_name, metric_value, unit, quality)
SELECT
    device_id,
    CURRENT_TIMESTAMP,
    'occupancy',
    42,
    'people',
    'GOOD'
FROM devices
WHERE serial_number = 'DEMO-IOT-003';

INSERT INTO device_telemetry
(device_id, timestamp, metric_name, metric_value, unit, quality)
SELECT
    device_id,
    CURRENT_TIMESTAMP,
    'battery',
    87,
    'percent',
    'GOOD'
FROM devices
WHERE serial_number = 'DEMO-IOT-004';

-- =========================================================
-- IoT EVENTS
-- =========================================================

INSERT INTO iot_events
(
    device_id,
    site_id,
    event_type,
    severity,
    event_timestamp,
    description,
    payload,
    processed
)
SELECT
    d.device_id,
    d.site_id,
    'MOTION_DETECTED',
    'INFO',
    CURRENT_TIMESTAMP,
    'Motion detected near monitored area.',
    '{"motion": true}',
    TRUE
FROM devices d
WHERE d.serial_number = 'DEMO-IOT-001';

INSERT INTO iot_events
(
    device_id,
    site_id,
    event_type,
    severity,
    event_timestamp,
    description,
    payload,
    processed
)
SELECT
    d.device_id,
    d.site_id,
    'DEVICE_HEALTH_CHECK',
    'INFO',
    CURRENT_TIMESTAMP,
    'Device reported healthy status.',
    '{"health": "healthy"}',
    TRUE
FROM devices d
WHERE d.serial_number = 'DEMO-IOT-002';

-- =========================================================
-- ACCESS EVENTS
-- =========================================================

INSERT INTO access_events
(
    door_id,
    reader_id,
    credential_id,
    event_type,
    result,
    event_timestamp,
    device_timestamp,
    source,
    metadata
)
SELECT
    d.door_id,
    r.reader_id,
    c.credential_id,
    'ACCESS_GRANTED',
    'SUCCESS',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'SIMULATOR',
    '{"demo": true}'
FROM doors d
JOIN readers r ON r.door_id = d.door_id
JOIN credentials c ON c.credential_identifier = 'CARD-DEMO-001'
WHERE d.door_name = 'Main Entrance';

INSERT INTO access_events
(
    door_id,
    reader_id,
    credential_id,
    event_type,
    result,
    event_timestamp,
    device_timestamp,
    source,
    metadata
)
SELECT
    d.door_id,
    r.reader_id,
    c.credential_id,
    'ACCESS_DENIED',
    'DENIED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'SIMULATOR',
    '{"reason": "demo_failed_attempt"}'
FROM doors d
JOIN readers r ON r.door_id = d.door_id
JOIN credentials c ON c.credential_identifier = 'CARD-DEMO-002'
WHERE d.door_name = 'Server Room';

-- =========================================================
-- OPPORTUNITIES
-- =========================================================

INSERT INTO opportunities
(
    customer_id,
    site_id,
    opportunity_name,
    description,
    sales_stage,
    estimated_value,
    probability,
    expected_close_date,
    sales_rep_id,
    competitor,
    priority
)
SELECT
    c.customer_id,
    s.site_id,
    'Access Control Modernization',
    'Modernization opportunity for aging access-control infrastructure.',
    'TECHNICAL_DISCOVERY',
    185000.00,
    78.00,
    CURRENT_DATE + INTERVAL '90 days',
    3,
    'Legacy Access Vendor',
    'HIGH'
FROM customers c
JOIN sites s ON s.customer_id = c.customer_id
WHERE c.company_name = 'Northstar Manufacturing'
AND s.site_name = 'Northstar Main Facility';

INSERT INTO opportunities
(
    customer_id,
    site_id,
    opportunity_name,
    description,
    sales_stage,
    estimated_value,
    probability,
    expected_close_date,
    sales_rep_id,
    competitor,
    priority
)
SELECT
    c.customer_id,
    s.site_id,
    'Multi-Tenant Access Upgrade',
    'Access-control modernization across office building.',
    'DISCOVERY',
    92000.00,
    61.00,
    CURRENT_DATE + INTERVAL '120 days',
    3,
    'Regional Security Provider',
    'MEDIUM'
FROM customers c
JOIN sites s ON s.customer_id = c.customer_id
WHERE c.company_name = 'Pinecrest Business Center'
AND s.site_name = 'Pinecrest Tower';

INSERT INTO opportunities
(
    customer_id,
    site_id,
    opportunity_name,
    description,
    sales_stage,
    estimated_value,
    probability,
    expected_close_date,
    sales_rep_id,
    competitor,
    priority
)
SELECT
    c.customer_id,
    s.site_id,
    'Warehouse Security Expansion',
    'Expansion opportunity involving access control and IoT monitoring.',
    'QUALIFICATION',
    67000.00,
    48.00,
    CURRENT_DATE + INTERVAL '150 days',
    3,
    'Existing Internal System',
    'MEDIUM'
FROM customers c
JOIN sites s ON s.customer_id = c.customer_id
WHERE c.company_name = 'Summit Distribution Group'
AND s.site_name = 'Summit Distribution Center';

-- =========================================================
-- FIELD VISITS
-- =========================================================

INSERT INTO field_visits
(
    customer_id,
    site_id,
    sales_rep_id,
    visit_date,
    visit_type,
    purpose,
    customer_needs,
    pain_points,
    existing_system,
    door_count,
    employee_count,
    technical_requirements,
    recommended_solution,
    next_action,
    follow_up_date
)
SELECT
    c.customer_id,
    s.site_id,
    3,
    CURRENT_TIMESTAMP,
    'SITE_ASSESSMENT',
    'Evaluate access-control modernization requirements.',
    'Improve credential management and centralized monitoring.',
    'Legacy access system and manual administration.',
    'Legacy RFID access-control system.',
    186,
    620,
    'Centralized management, modern readers, reporting, and integration.',
    'Modern access-control platform with centralized management.',
    'Schedule technical design review.',
    CURRENT_DATE + INTERVAL '7 days'
FROM customers c
JOIN sites s ON s.customer_id = c.customer_id
WHERE c.company_name = 'Northstar Manufacturing';

-- =========================================================
-- ACTIVITIES
-- =========================================================

INSERT INTO activities
(
    customer_id,
    opportunity_id,
    user_id,
    activity_type,
    subject,
    description,
    activity_timestamp,
    outcome,
    next_action
)
SELECT
    c.customer_id,
    o.opportunity_id,
    3,
    'MEETING',
    'Technical Discovery Meeting',
    'Reviewed current access-control environment and business requirements.',
    CURRENT_TIMESTAMP,
    'Customer interested in modernization.',
    'Schedule technical design review.'
FROM customers c
JOIN opportunities o ON o.customer_id = c.customer_id
WHERE c.company_name = 'Northstar Manufacturing';

-- =========================================================
-- AI PREDICTIONS
-- =========================================================

INSERT INTO ai_predictions
(
    customer_id,
    opportunity_id,
    model_name,
    model_version,
    prediction_type,
    prediction_value,
    confidence_score,
    explanation
)
SELECT
    c.customer_id,
    o.opportunity_id,
    'demo_opportunity_scoring_model',
    '1.0',
    'OPPORTUNITY_SCORE',
    88,
    0.91,
    'High company fit, significant technical need, strong engagement, and near-term buying timeline.'
FROM customers c
JOIN opportunities o ON o.customer_id = c.customer_id
WHERE c.company_name = 'Northstar Manufacturing'
AND o.opportunity_name = 'Access Control Modernization';

-- =========================================================
-- AI RECOMMENDATIONS
-- =========================================================

INSERT INTO ai_recommendations
(
    customer_id,
    opportunity_id,
    prediction_id,
    recommendation_type,
    recommendation_text,
    priority,
    reason,
    status
)
SELECT
    p.customer_id,
    p.opportunity_id,
    p.prediction_id,
    'FIELD_VISIT',
    'Schedule a technical site assessment and review modernization requirements.',
    'HIGH',
    p.explanation,
    'NEW'
FROM ai_predictions p
JOIN opportunities o ON o.opportunity_id = p.opportunity_id
WHERE o.opportunity_name = 'Access Control Modernization';

-- =========================================================
-- AUDIT LOG
-- =========================================================

INSERT INTO audit_logs
(
    user_id,
    action,
    resource_type,
    resource_id,
    result,
    details
)
VALUES
(
    3,
    'CREATE_FIELD_VISIT',
    'FIELD_VISIT',
    'DEMO-VISIT-001',
    'SUCCESS',
    '{"source": "seed_data", "demo": true}'
),
(
    3,
    'CREATE_OPPORTUNITY',
    'OPPORTUNITY',
    'DEMO-OPPORTUNITY-001',
    'SUCCESS',
    '{"source": "seed_data", "demo": true}'
);

COMMIT;