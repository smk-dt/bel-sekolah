// ============================================================
// SMART BELL IoT - Schedule API (Supabase Edge Function)
// ============================================================
// Secure channel: ESP32 -> /functions/v1/schedule-api -> schedules
//
// Request (POST, JSON):
//   {
//     "device_id": "SB-001",
//     "token":     "<per-device secret>",
//     "action":    "get_schedule"
//   }
//
// Auth model:
//   - anon key (apikey header) lets any client reach the function.
//   - Real gate is device_id + token, validated below.
//   - DB reads use SUPABASE_SERVICE_ROLE_KEY (server-side only).
//
// Environment secrets (reuse from device-api):
//   DEVICE_SB001_SECRET=<token for SB-001>
//   DEVICE_SB002_SECRET=<token for SB-002>
//
// Response codes:
//   200 success | 400 invalid payload/action | 401 invalid token |
//   403 unknown device | 405 method | 500 db error
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEVICE_SECRETS: Record<string, string> = {
  "SB-001": Deno.env.get("DEVICE_SB001_SECRET") ?? "",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const deviceId = body.device_id;
  const token = body.token;
  const action = body.action;

  if (typeof deviceId !== "string" || deviceId.length === 0) {
    return json(400, { error: "Missing device_id" });
  }

  const expectedToken = DEVICE_SECRETS[deviceId];
  if (expectedToken === undefined) {
    return json(403, { error: "Unknown device" });
  }
  if (typeof token !== "string" || token !== expectedToken || expectedToken.length === 0) {
    return json(401, { error: "Invalid token" });
  }

  if (action !== "get_schedule") {
    return json(400, { error: "Invalid action" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Resolve public.devices.id (UUID) from text device_id "SB-001"
  const { data: dev, error: devErr } = await supabase
    .from("devices")
    .select("id")
    .eq("device_id", deviceId)
    .single();

  if (devErr || !dev) {
    if (devErr) console.error("device lookup failed:", devErr.message, devErr.details, devErr.hint);
    return json(403, { error: "Unknown device", details: devErr?.message });
  }

  const deviceUuid = (dev as { id: string }).id;

  // Fetch firmware-ready schedule rows directly from schedules.
  const { data: rows, error } = await supabase
    .from("schedules")
    .select("id, name, day, time, enabled, track")
    .eq("device_id", deviceUuid)
    .order("day", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    const { message, details, hint, code } = error as any;
    console.error("schedules query failed:", message, details, hint, code);
    return json(500, { error: "Database error", message, details, hint, code });
  }

  const schedules = (rows as unknown as Array<{
    id: string;
    name: string;
    day: number;
    time: string;
    enabled: boolean;
    track: number;
  }>).map((r) => {
    const timeHHmm = typeof r.time === "string" ? r.time.slice(0, 5) : String(r.time);
    return {
      id: r.id,
      name: r.name,
      day: r.day,
      time: timeHHmm,
      enabled: r.enabled,
      track: r.track,
    };
  });

  return json(200, {
    ok: true,
    device_id: deviceId,
    server_time: new Date().toISOString(),
    schedules,
  });
});

