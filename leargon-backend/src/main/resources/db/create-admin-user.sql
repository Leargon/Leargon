-- Create Initial Admin User
-- This script creates a default admin user for Léargon
--
-- Default credentials:
--   Email: admin@leargon.local
--   Username: admin
--   Password: ChangeMe123!
--
-- IMPORTANT: Change the password immediately after first login!
--
-- The password hash below is for 'ChangeMe123!' with BCrypt strength 12
-- To generate a new hash, use the signup endpoint and copy the hash from the database,
-- or use: htpasswd -bnBC 12 "" yourpassword | tr -d ':\n'

INSERT INTO users (
    email,
    username,
    password_hash,
    first_name,
    last_name,
    enabled,
    account_locked,
    account_expired,
    password_expired,
    roles,
    created_at,
    updated_at
) VALUES (
    'admin@leargon.local',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYMIJfKxcU.8Jgq',  -- Password: ChangeMe123!
    'System',
    'Administrator',
    true,
    false,
    false,
    false,
    'ROLE_USER,ROLE_ADMIN',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
    roles = 'ROLE_USER,ROLE_ADMIN',
    enabled = true,
    account_locked = false;

-- Verify the admin user was created
SELECT id, email, username, roles, enabled, created_at
FROM users
WHERE email = 'admin@leargon.local';
