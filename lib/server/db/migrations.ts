export const MIGRATIONS: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    created_at    DATETIME     NOT NULL,
    updated_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY idx_users_email (email)
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash VARCHAR(100) NOT NULL,
    user_id    CHAR(36)     NOT NULL,
    created_at DATETIME     NOT NULL,
    expires_at DATETIME     NOT NULL,
    PRIMARY KEY (token_hash),
    KEY idx_sessions_expires_at (expires_at),
    KEY idx_sessions_user_id (user_id),
    CONSTRAINT fk_sessions_user_id
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT          NOT NULL AUTO_INCREMENT,
    attempt_key VARCHAR(500) NOT NULL,
    created_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_login_attempts_key_created (attempt_key, created_at DESC),
    KEY idx_login_attempts_created_at (created_at)
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id                           CHAR(36)                              NOT NULL,
    workspace_id                 VARCHAR(100)                          NOT NULL,
    type                         ENUM('business', 'personal')          NOT NULL,
    kind                         ENUM('expense', 'income', 'transfer') NOT NULL,
    payment_method               ENUM('cash', 'kpay')                  NULL,
    transfer_from_payment_method ENUM('cash', 'kpay')                  NULL,
    transfer_to_payment_method   ENUM('cash', 'kpay')                  NULL,
    amount                       DOUBLE                                NOT NULL,
    paid_by_user_id              VARCHAR(100)                          NOT NULL,
    owner_user_id                VARCHAR(100)                          NOT NULL,
    date                         CHAR(10)                              NOT NULL,
    note                         VARCHAR(160)                          NOT NULL DEFAULT '',
    created_at                   DATETIME                              NOT NULL,
    updated_at                   DATETIME                              NOT NULL,
    PRIMARY KEY (id),
    KEY idx_expenses_ws_type_date       (workspace_id, type, date DESC),
    KEY idx_expenses_ws_type_kind_date  (workspace_id, type, kind, date DESC),
    KEY idx_expenses_ws_type_pm_date    (workspace_id, type, payment_method, date DESC),
    KEY idx_expenses_ws_owner_type_date (workspace_id, owner_user_id, type, date DESC)
  )`,

  `CREATE TABLE IF NOT EXISTS expense_audits (
    id            CHAR(36)                 NOT NULL,
    workspace_id  VARCHAR(100)             NOT NULL,
    expense_id    CHAR(36)                 NOT NULL,
    action        ENUM('create', 'delete') NOT NULL,
    actor_user_id VARCHAR(100)             NOT NULL,
    expense_json  TEXT                     NOT NULL,
    created_at    DATETIME                 NOT NULL,
    PRIMARY KEY (id),
    KEY idx_expense_audits_ws_exp_created   (workspace_id, expense_id, created_at DESC),
    KEY idx_expense_audits_ws_actor_created (workspace_id, actor_user_id, created_at DESC)
  )`,

  `CREATE TABLE IF NOT EXISTS monthly_closes (
    id                   CHAR(36)     NOT NULL,
    workspace_id         VARCHAR(100) NOT NULL,
    month_key            CHAR(7)      NOT NULL,
    cash_opening_balance DOUBLE       NOT NULL,
    kpay_opening_balance DOUBLE       NOT NULL,
    cash_closing_balance DOUBLE       NOT NULL,
    kpay_closing_balance DOUBLE       NOT NULL,
    income_total         DOUBLE       NOT NULL,
    expense_total        DOUBLE       NOT NULL,
    transfer_total       DOUBLE       NOT NULL,
    transaction_count    INT          NOT NULL,
    closed_by_user_id    VARCHAR(100) NOT NULL,
    closed_at            DATETIME     NOT NULL,
    updated_at           DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY idx_monthly_closes_ws_month (workspace_id, month_key)
  )`
]
