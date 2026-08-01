-- FIX: get_pending_commands - column reference "id" is ambiguous
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ratkhbsmtfvuvngavqdk/sql

CREATE OR REPLACE FUNCTION get_pending_commands(p_device_id TEXT)
RETURNS TABLE(id BIGINT, command TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH pending AS (
        SELECT ec.id
        FROM esp_commands ec
        WHERE ec.device_id = p_device_id
          AND ec.status = 'pending'
        ORDER BY ec.id ASC
        LIMIT 5
        FOR UPDATE SKIP LOCKED
    )
    UPDATE esp_commands
    SET status = 'processing'
    WHERE esp_commands.id IN (SELECT pending.id FROM pending)
    RETURNING esp_commands.id, esp_commands.command;
END;
$$ LANGUAGE plpgsql;