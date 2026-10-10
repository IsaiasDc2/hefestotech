// HefestoTech · scripts/create-test-admin.mjs
// Crea un admin de PRUEBA con contraseña aleatoria (se imprime UNA vez).
// Requiere: ALLOW_TEST_ADMIN=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// Uso: ALLOW_TEST_ADMIN=1 node scripts/create-test-admin.mjs
// NUNCA commitear salidas ni correr sin leer. Solo desde la terminal.
const allow = process.env.ALLOW_TEST_ADMIN === "1";
if (!allow) {
  console.error("Negado: definí ALLOW_TEST_ADMIN=1 para ejecutar.");
  process.exit(1);
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const rand = (n) => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => abc[x % abc.length]).join("");
};
const sufijo = rand(6);
const email = `admin.prueba.${sufijo}@example.com`;
const password = rand(18);
const expira = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

const admin = async (path, opts = {}) => {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
};

const user = await admin("/users", {
  method: "POST",
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { test: true } }),
});
const upsert = async (tabla, body) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${tabla} -> ${r.status} ${await r.text()}`);
};
await upsert("perfiles", {
  id: user.id, rol: "admin", is_test_user: true, expires_at: expira,
});
console.log("Cuenta de prueba creada (72 h). Guardá esto, no se repite:");
console.log(`  URL:      ${process.env.FRONTEND_URL ?? "tu front"}#/admin (o /admin)`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log(`  Expira:   ${expira}`);
console.log("Borrar: npm run delete-test-admin -- <email>  (o SQL: delete from auth.users where email='<email>')");
