-- Peaky local dev bootstrap — runs once on first container initialisation.
-- Creates the application user and database.
-- Note: CREATE DATABASE cannot run in a transaction block, so each statement
-- is deliberately separated.  The postgres entrypoint runs each \;-delimited
-- statement as its own transaction.

CREATE USER peaky WITH PASSWORD 'peaky';
