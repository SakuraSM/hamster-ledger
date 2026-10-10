export function migrateNetwork(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const columns = database.prepare("PRAGMA table_info(books)").all();
    if (!columns.some((column) => column.name === "authority"))
      database.exec(
        "ALTER TABLE books ADD COLUMN authority TEXT NOT NULL DEFAULT 'snapshot'",
      );
    database.exec(`
      CREATE TABLE IF NOT EXISTS book_members(book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL,PRIMARY KEY(book_id,user_id));
      CREATE TABLE IF NOT EXISTS book_invites(id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,code_hash TEXT UNIQUE NOT NULL,role TEXT NOT NULL,expires_at INTEGER NOT NULL,used_by TEXT,revoked_at INTEGER,created_by TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS book_backups(id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,ledger TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS book_operations(id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id TEXT NOT NULL,source TEXT NOT NULL,summary TEXT NOT NULL,revision INTEGER NOT NULL,before_json TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS book_requests(book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id TEXT NOT NULL,request_key TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(book_id,user_id,request_key));
      CREATE TABLE IF NOT EXISTS open_tokens(id TEXT PRIMARY KEY,book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id TEXT NOT NULL,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,scopes TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS open_rate_limits(token_id TEXT PRIMARY KEY REFERENCES open_tokens(id) ON DELETE CASCADE,window INTEGER NOT NULL,hits INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS open_requests(token_id TEXT NOT NULL REFERENCES open_tokens(id) ON DELETE CASCADE,request_key TEXT NOT NULL,digest TEXT NOT NULL,status INTEGER NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(token_id,request_key));
      CREATE TABLE IF NOT EXISTS fx_rates(currency TEXT NOT NULL,date TEXT NOT NULL,rate TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(currency,date));
      CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,book_id TEXT REFERENCES books(id) ON DELETE CASCADE,user_id TEXT NOT NULL,mime TEXT NOT NULL,name TEXT NOT NULL,hash TEXT NOT NULL,bytes BLOB NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS model_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,configuration TEXT NOT NULL,secret TEXT);
      CREATE TABLE IF NOT EXISTS book_options(book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,ai_auto_post INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS scheduler_runs(book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,occurrence TEXT NOT NULL,PRIMARY KEY(book_id,occurrence));
      CREATE INDEX IF NOT EXISTS book_operations_time ON book_operations(book_id,revision);
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
