CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  scope VARCHAR(20) NOT NULL DEFAULT 'general',
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_week_order CHECK (week_end >= week_start),
  CONSTRAINT chk_session_scope CHECK (scope IN ('general', 'personal')),
  INDEX idx_sessions_scope (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Other',
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  purchased_at DATE NOT NULL,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  INDEX idx_expenses_session (session_id),
  INDEX idx_expenses_date (purchased_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
