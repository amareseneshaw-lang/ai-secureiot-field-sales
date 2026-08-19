-- AI SecureIoT Field Sales Platform
-- Database Schema
-- Project Owner: Amare Seneshaw
-- Version: 1.0

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE TABLE user_roles (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(user_id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    employee_count INTEGER,
    account_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    primary_phone VARCHAR(50),
    primary_email VARCHAR(255),
    website VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    account_owner_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contacts (
    contact_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    job_title VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    contact_type VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sites (
    site_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    site_type VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    assigned_technician_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE buildings (
    building_id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    building_name VARCHAR(255) NOT NULL,
    building_type VARCHAR(100),
    floor_count INTEGER,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE controllers (
    controller_id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    controller_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(150) UNIQUE,
    firmware_version VARCHAR(100),
    ip_address INET,
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE readers (
    reader_id SERIAL PRIMARY KEY,
    door_id INTEGER,
    reader_name VARCHAR(255) NOT NULL,
    reader_type VARCHAR(50),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(150) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doors (
    door_id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(building_id) ON DELETE CASCADE,
    door_name VARCHAR(255) NOT NULL,
    door_type VARCHAR(100),
    location_description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'SECURE',
    controller_id INTEGER REFERENCES controllers(controller_id),
    reader_id INTEGER REFERENCES readers(reader_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE readers
ADD CONSTRAINT fk_reader_door
FOREIGN KEY (door_id) REFERENCES doors(door_id) ON DELETE SET NULL;

CREATE TABLE credentials (
    credential_id SERIAL PRIMARY KEY,
    credential_type VARCHAR(50) NOT NULL,
    credential_identifier VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    issued_to_user_id INTEGER REFERENCES users(user_id),
    issued_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE access_events (
    access_event_id BIGSERIAL PRIMARY KEY,
    door_id INTEGER REFERENCES doors(door_id),
    reader_id INTEGER REFERENCES readers(reader_id),
    credential_id INTEGER REFERENCES credentials(credential_id),
    event_type VARCHAR(50) NOT NULL,
    result VARCHAR(30),
    event_timestamp TIMESTAMP NOT NULL,
    device_timestamp TIMESTAMP,
    source VARCHAR(50),
    metadata JSONB
);

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(150) UNIQUE,
    firmware_version VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    health_status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',
    last_seen_at TIMESTAMP,
    installed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_telemetry (
    telemetry_id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    unit VARCHAR(50),
    quality VARCHAR(30),
    metadata JSONB
);

CREATE TABLE iot_events (
    iot_event_id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(30) NOT NULL DEFAULT 'INFO',
    event_timestamp TIMESTAMP NOT NULL,
    description TEXT,
    payload JSONB,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE opportunities (
    opportunity_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(site_id),
    opportunity_name VARCHAR(255) NOT NULL,
    description TEXT,
    sales_stage VARCHAR(50) NOT NULL DEFAULT 'LEAD',
    estimated_value NUMERIC(14,2),
    probability NUMERIC(5,2),
    expected_close_date DATE,
    sales_rep_id INTEGER REFERENCES users(user_id),
    competitor VARCHAR(255),
    priority VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE field_visits (
    visit_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(site_id),
    sales_rep_id INTEGER REFERENCES users(user_id),
    visit_date TIMESTAMP NOT NULL,
    visit_type VARCHAR(50),
    purpose TEXT,
    customer_needs TEXT,
    pain_points TEXT,
    existing_system TEXT,
    door_count INTEGER,
    employee_count INTEGER,
    technical_requirements TEXT,
    recommended_solution TEXT,
    next_action TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
    activity_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
    opportunity_id INTEGER REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id),
    activity_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    description TEXT,
    activity_timestamp TIMESTAMP NOT NULL,
    outcome TEXT,
    next_action TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
    opportunity_id INTEGER REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    model_name VARCHAR(150) NOT NULL,
    model_version VARCHAR(50),
    prediction_type VARCHAR(100) NOT NULL,
    prediction_value NUMERIC,
    confidence_score NUMERIC(5,4),
    explanation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
    opportunity_id INTEGER REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    prediction_id BIGINT REFERENCES ai_predictions(prediction_id),
    recommendation_type VARCHAR(100) NOT NULL,
    recommendation_text TEXT NOT NULL,
    priority VARCHAR(30),
    reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(user_id),
    reviewed_at TIMESTAMP
);

CREATE TABLE audit_logs (
    audit_log_id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    result VARCHAR(30),
    details JSONB
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_customers_account_owner
ON customers(account_owner_id);

CREATE INDEX idx_contacts_customer
ON contacts(customer_id);

CREATE INDEX idx_sites_customer
ON sites(customer_id);

CREATE INDEX idx_buildings_site
ON buildings(site_id);

CREATE INDEX idx_doors_building
ON doors(building_id);

CREATE INDEX idx_devices_site
ON devices(site_id);

CREATE INDEX idx_device_telemetry_device_time
ON device_telemetry(device_id, timestamp);

CREATE INDEX idx_iot_events_site_time
ON iot_events(site_id, event_timestamp);

CREATE INDEX idx_access_events_door_time
ON access_events(door_id, event_timestamp);

CREATE INDEX idx_opportunities_customer
ON opportunities(customer_id);

CREATE INDEX idx_opportunities_sales_rep
ON opportunities(sales_rep_id);

CREATE INDEX idx_field_visits_customer
ON field_visits(customer_id);

CREATE INDEX idx_field_visits_sales_rep
ON field_visits(sales_rep_id);

CREATE INDEX idx_ai_predictions_opportunity
ON ai_predictions(opportunity_id);

CREATE INDEX idx_audit_logs_user_time
ON audit_logs(user_id, timestamp);

-- =========================================================
-- BASIC CHECK CONSTRAINTS
-- =========================================================

ALTER TABLE users
ADD CONSTRAINT chk_user_status
CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'));

ALTER TABLE opportunities
ADD CONSTRAINT chk_opportunity_probability
CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100));

ALTER TABLE ai_predictions
ADD CONSTRAINT chk_ai_confidence
CHECK (
    confidence_score IS NULL
    OR (confidence_score >= 0 AND confidence_score <= 1)
);

ALTER TABLE iot_events
ADD CONSTRAINT chk_iot_severity
CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- =========================================================
-- SCHEMA COMPLETE
-- =========================================================