-- Phase 1.1 — extensions and the private schema.
--
-- btree_gist is enabled now even though the first user is Phase 3 (soft-hold
-- exclusion approach was rejected, but btree_gist is cheap and a sibling
-- pattern may want it later). pg_trgm backs fuzzy client search.
--
-- The `private` schema holds security-definer helpers and trigger functions
-- that must never be exposed via PostgREST. Revoking from public/anon/
-- authenticated keeps the schema invisible to the Data API.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
