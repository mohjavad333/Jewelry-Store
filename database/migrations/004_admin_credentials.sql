ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS identifier TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS key_hash TEXT;

UPDATE admin_users
SET identifier = 'primary-admin'
WHERE id = 'primary-admin' AND identifier IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_identifier_idx
ON admin_users (LOWER(identifier))
WHERE identifier IS NOT NULL;
