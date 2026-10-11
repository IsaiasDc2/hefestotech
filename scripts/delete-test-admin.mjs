// HefestoTech · scripts/delete-test-admin.mjs
// Elimina la cuenta de prueba: npm run delete-test-admin -- <email>
// Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en el entorno.
const email = process.argv[2];
if (!email) {
  console.error("Uso: npm run delete-test-admin -- <email>");
  process.exit(1);
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};
const list = await (await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users`, { headers })).json();
const users = (list?.users ?? []).filter((u) => u.email === email);
for (const u of users) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
    method: "DELETE", headers,
  });
  console.log(email, r.ok ? "eliminado" : `falló ${r.status}`);
}
if (users.length === 0) console.log("Sin coincidencias para", email);
