import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8012"


def call(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            return r.status, r.read()[:150].decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200].decode(errors="replace")
    except Exception as e:  # noqa: BLE001
        return 0, str(e)[:150]


for _ in range(20):
    if call("/")[0] == 200:
        break
    time.sleep(1)

code, txt = call("/api/admin/clientes")
print("clientes sin auth (esperado 401):", code, txt)
code, txt = call("/api/admin/clientes?q=ana")
print("clientes con q sin auth (esperado 401):", code, txt)
