-- Password Reset Tokens Table
-- Stores temporary tokens for password reset functionality

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL, -- Unix timestamp
  created_at INTEGER NOT NULL, -- Unix timestamp
  used_at INTEGER, -- Unix timestamp when token was used, NULL = not used
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);

