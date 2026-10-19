#!/bin/bash
# Creates the Authentik database and user. Runs once on first postgres init.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER authentik WITH PASSWORD '${AUTHENTIK_POSTGRES_PASSWORD}';
    CREATE DATABASE authentik OWNER authentik;
    GRANT ALL PRIVILEGES ON DATABASE authentik TO authentik;
EOSQL
