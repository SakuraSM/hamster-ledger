#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password LEDGER_DB_PASSWORD
CREATE ROLE hamster LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
ALTER DATABASE hamster OWNER TO hamster;
GRANT CONNECT ON DATABASE hamster TO hamster;
GRANT USAGE, CREATE ON SCHEMA public TO hamster;
SQL
