-- PostgreSQL test data for LemonLDAP::NG DBI modules

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    password VARCHAR(256),
    name VARCHAR(256),
    mail VARCHAR(256),
    department VARCHAR(128),
    phone VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clear existing data
TRUNCATE TABLE users;

-- Insert test users
INSERT INTO users (user_id, password, name, mail, department, phone) VALUES
    ('dwho', 'dwho', 'Doctor Who', 'dwho@example.com', 'Time Lords', '+44123456'),
    ('rtyler', 'rtyler', 'Rose Tyler', 'rtyler@example.com', 'Companions', '+44987654'),
    ('french', 'french', 'Frédéric Accents', 'french@example.com', 'Département Français', '+33123456'),
    ('russian', 'russian', 'Русский Пользователь', 'russian@example.com', 'Отдел', '+7123456');

-- Create sessions table for session storage tests (with JSONB support)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    a_session JSONB NOT NULL,
    _utime BIGINT DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
);

-- Create saml_sessions table
CREATE TABLE IF NOT EXISTS saml_sessions (
    id VARCHAR(128) PRIMARY KEY,
    a_session JSONB NOT NULL,
    _utime BIGINT DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
);

-- Create oidc_sessions table
CREATE TABLE IF NOT EXISTS oidc_sessions (
    id VARCHAR(128) PRIMARY KEY,
    a_session JSONB NOT NULL,
    _utime BIGINT DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
);

-- Create cas_sessions table
CREATE TABLE IF NOT EXISTS cas_sessions (
    id VARCHAR(128) PRIMARY KEY,
    a_session JSONB NOT NULL,
    _utime BIGINT DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
);
