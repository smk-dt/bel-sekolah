// ============================================================
// SMART BELL IoT - Device API (Supabase Edge Function)
// ============================================================
// Secure channel: ESP32 -> /functions/v1/device-api -> devices
//
// Request (POST, JSON):
//   {
//     "device_id": "SB-001",
//     "token":     "<per-device secret>",
//     "action":    "register" | "heartbeat" | "commands",
//     "payload":   { ...columns of public.devices... }
//   }
//
// Auth model:
//   - The publishable/anon key (apikey header) lets any client reach
//     the function (public invocation).
//   - The real gate is device_id + token, validated below.
//   - DB writes use SUPABASE_SERVICE_ROLE_KEY (server-side secret,
//     never exposed to the device).
//
// Environment secrets (set via: supabase secrets set ...):
//   DEVICE_SB001_SECRET=<token for SB-001>
//   DEVICE_SB002_SECRET=<token for SB-002>   (as devices are added)
//
// Response codes:
//   200 success | 400 invalid payload | 401 invalid token |
//   403 unknown device | 405 method | 500 db error
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEVICE_SECRETS: Record<string, string> = {
  "SB-001": Deno.env.get("DEVICE_SB001_SECRET") ?? "",
};

// Columns a device may send on register (must match server/schema.sql).
const REGISTER_FIELDS = [
  "device_id", "device_name", "firmware_version", "status",
  "ip_address", "wifi_ssid", "wifi_rssi", "internet_status",
  "rtc_time", "rtc_status", "ntp_status", "dfplayer_status",
  "micro_sd_status", "relay1", "relay2", "bell_status",
  "last_boot", "last_seen",
];

// Columns a heartbeat may update (keeps the periodic call small).
const HEARTBEAT_FIELDS = [
  "status", "ip_address", "wifi_ssid", "wifi_rssi", "internet_status",
  "rtc_time", "rtc_status", "relay1", "relay2", "bell_status", "last_seen",
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Keep only whitelisted columns from a payload (drops anything unknown).
function pick(payload: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (payload[k] !== undefined) out[k] = payload[k];
  }
  return out;
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
  const payload = body.payload;

  if (typeof deviceId !== "string" || deviceId.length === 0) {
    return json(400, { error: "Missing device_id" });
  }

  const expectedToken = DEVICE_SECRETS[deviceId];
  if (expectedToken === undefined) {
    return json(403, { error: "Unknown device" });
  }
  if (typeof token !== "string" || token !== expectedToken) {
    return json(401, { error: "Invalid token" });
  }

  if (typeof action !== "string" || (action !== "register" && action !== "heartbeat" && action !== "commands")) {
    return json(400, { error: "Invalid action" });
  }
  if (typeof payload !== "object" || payload === null) {
    return json(400, { error: "Missing payload" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  if (action === "register") {
    const data = pick(payload as Record<string, unknown>, REGISTER_FIELDS);
    if (data["device_id"] !== deviceId) {
      return json(400, { error: "device_id mismatch" });
    }
    const { error } = await supabase
      .from("devices")
      .upsert(data, { onConflict: "device_id" });
    if (error) {
      console.error("register upsert failed:", error.message);
      return json(500, { error: "Database error" });
    }
    return json(200, { ok: true });
  }

  if (action === "commands") {
    // Return pending commands without updating device status/telemetry
    const { data: dev } = await supabase
      .from("devices")
      .select("id")
      .eq("device_id", deviceId)
      .single();

    const commands: { id: string; type: string; payload: Record<string, unknown> }[] = [];
    if (dev) {
      const { data: cmds } = await supabase
        .from("device_commands")
        .select("id, command_type, payload")
        .eq("device_id", dev.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5);

      if (cmds && cmds.length > 0) {
        for (const c of cmds) {
          commands.push({ id: c.id, type: c.command_type, payload: c.payload ?? {} });
        }
        const ids = cmds.map((c) => c.id);
        await supabase
          .from("device_commands")
          .update({ status: "sent" })
          .in("id", ids);
      }
    }
    return json(200, { ok: true, commands });
  }

  // heartbeat
  const data = pick(payload as Record<string, unknown>, HEARTBEAT_FIELDS);
  const { error } = await supabase
    .from("devices")
    .update(data)
    .eq("device_id", deviceId);
  if (error) {
    console.error("heartbeat update failed:", error.message);
    return json(500, { error: "Database error" });
  }

  // Resolve device UUID for command lookup
  const { data: dev, error: devError } = await supabase
    .from("devices")
    .select("id")
    .eq("device_id", deviceId)
    .single();

  console.log(`[DEVICE API] device_id=${deviceId} matched=${Boolean(dev)}${devError ? ` error=${devError.message}` : ""}`);

  // Fetch pending commands for this device
  const commands: { id: string; type: string; payload: Record<string, unknown> }[] = [];
  if (dev) {
    const { data: cmds } = await supabase
      .from("device_commands")
      .select("id, command_type, payload")
      .eq("device_id", dev.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    console.log(`[DEVICE API] pending commands=${cmds?.length ?? 0}`);
    if (cmds && cmds.length > 0) {
      for (const c of cmds) {
        console.log(`[DEVICE API] sending command id=${c.id} type=${c.command_type} payload=${JSON.stringify(c.payload ?? {})}`);
        commands.push({ id: c.id, type: c.command_type, payload: c.payload ?? {} });
      }
      // Mark as sent so they aren't returned again
      const ids = cmds.map((c) => c.id);
      await supabase
        .from("device_commands")
        .update({ status: "sent" })
        .in("id", ids);
    }
  }

  return json(200, { ok: true, commands });
});
