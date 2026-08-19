-- One-time setup for the Lacosta users database.
-- Run as a superuser:  psql -U sadamjr -d postgres -f scripts/setup-db.sql

CREATE ROLE lacosta WITH LOGIN PASSWORD 'lacosta-local-7f3k9';
CREATE DATABASE lacosta OWNER lacosta;