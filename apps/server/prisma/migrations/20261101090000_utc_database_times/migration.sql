-- Times written by the database itself are in UTC, like the app's (1 November 2026).
--
-- The app stores every time as UTC (Prisma fills in createdAt and the like). Rows written by
-- database triggers took the column default CURRENT_TIMESTAMP instead, which a
-- "timestamp without time zone" column stores in the database server's own time zone. On a server
-- set to Zambia / South Africa time (UTC+2), the marks history lines written by the trigger were
-- two hours "later" than the app's own lines, so the history came out in the wrong order and showed
-- times two hours ahead. Affected: mark_changes (marks history) and change_log (phone sync).

-- 1. The two columns the triggers fill in now default to UTC (schema.prisma says the same, so
--    Prisma doesn't see a difference).
ALTER TABLE public.mark_changes ALTER COLUMN "changedAt" SET DEFAULT timezone('UTC'::text, now());
ALTER TABLE public.change_log ALTER COLUMN "changedAt" SET DEFAULT timezone('UTC'::text, now());

-- 2. Correct the lines the triggers have already written in the server's time zone (nothing
--    changes when the server already runs on UTC). The "phone change not applied" lines were
--    written by the app, already in UTC, so they stay as they are.
UPDATE public.mark_changes
SET "changedAt" = ("changedAt" AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'UTC'
WHERE "action"::text <> 'PHONE_NOT_APPLIED';

UPDATE public.change_log
SET "changedAt" = ("changedAt" AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'UTC';
