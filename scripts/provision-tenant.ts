#!/usr/bin/env tsx
/**
 * Provision a new tenant + initial owner atomically.
 *
 *   tsx --env-file=.env.local scripts/provision-tenant.ts <slug> "<name>" <owner-email> [password]
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from process.env. The
 * service-role client bypasses RLS and is the only role granted execute
 * on public.provision_tenant_and_owner.
 *
 * Atomicity: tenant + tenant_users insert run inside a single Postgres
 * transaction via the RPC `provision_tenant_and_owner`. The auth user
 * creation is a separate API call; if the RPC fails after we created a
 * fresh auth user, we delete that user as cleanup. Existing users are
 * never deleted.
 *
 * Idempotency: re-running with an existing slug fails on the unique
 * constraint inside the RPC and rolls back atomically. Re-running with an
 * existing email reuses the auth.users row.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local."
  );
  process.exit(1);
}

const [, , slugArg, nameArg, emailArg, passwordArg] = process.argv;

if (!slugArg || !nameArg || !emailArg) {
  console.error(
    'Usage: tsx --env-file=.env.local scripts/provision-tenant.ts <slug> "<name>" <owner-email> [password]'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string): Promise<string | null> {
  // listUsers paginates server-side; perPage=1000 covers our 4-tenant cap
  // many times over. If a deployment outgrows this, fold in pagination.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

async function ensureUser(
  email: string,
  password: string | undefined
): Promise<{ userId: string; created: boolean; tempPassword?: string }> {
  const existingId = await findUserByEmail(email);
  if (existingId) return { userId: existingId, created: false };

  const tempPassword = password ?? randomBytes(12).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error("createUser returned no user");
  return { userId: data.user.id, created: true, tempPassword };
}

async function main() {
  const { userId, created, tempPassword } = await ensureUser(emailArg, passwordArg);
  console.log(`auth user: ${userId} ${created ? "(created)" : "(existing)"}`);
  if (created && !passwordArg) {
    console.log(`temporary password: ${tempPassword}`);
  }

  const { data: tenantId, error: rpcErr } = await supabase.rpc(
    "provision_tenant_and_owner",
    { _slug: slugArg, _name: nameArg, _user_id: userId }
  );

  if (rpcErr) {
    console.error(`provision_tenant_and_owner RPC failed: ${rpcErr.message}`);
    if (created) {
      console.error("Cleaning up auth user we just created...");
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) {
        console.error(`auth user cleanup ALSO failed: ${delErr.message}`);
        console.error(`orphan auth user: ${userId}`);
      }
    }
    process.exit(1);
  }

  console.log(`tenant: ${tenantId} slug=${slugArg} name=${nameArg}`);
  console.log(`membership: tenant=${tenantId} user=${userId} role=owner`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
