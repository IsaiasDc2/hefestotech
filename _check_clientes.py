import json
import urllib.error
import urllib.request

env = {}
for l in open(r"backend/.env", encoding="utf-8"):
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, v = l.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

u = env["SUPABASE_URL"].rstrip("/")
k = env["SUPABASE_SERVICE_ROLE_KEY"]


def get(p, base=None):
    try:
        r = urllib.request.urlopen(
            urllib.request.Request((base or u) + p, headers={"apikey": k, "Authorization": "Bearer " + k}),
            timeout=25,
        )
        return r.status, json.loads(r.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


code, perfiles = get("/rest/v1/perfiles?select=id,nombre,telefono,direccion,ciudad,codigo_postal,rol,created_at&order=created_at.desc&limit=10")
print("perfiles:", code, "filas:", len(perfiles) if isinstance(perfiles, list) else perfiles)

code, ordenes = get("/rest/v1/ordenes?select=user_id,estado,total_centavos,created_at&order=created_at.desc&limit=5")
print("ordenes metricas:", code, "filas:", len(ordenes) if isinstance(ordenes, list) else ordenes)

code, usuarios = get("/auth/v1/admin/users?page=1&per_page=1000")
if code == 200 and isinstance(usuarios, dict):
    lista = usuarios.get("users") or []
    con_mail = sum(1 for x in lista if x.get("email"))
    print("gotrue usuarios:", code, "total:", len(lista), "con email:", con_mail)
else:
    print("gotrue usuarios:", code, usuarios)
