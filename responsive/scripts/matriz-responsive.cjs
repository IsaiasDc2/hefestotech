const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");
const { AxeBuilder } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/@axe-core/playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:5199/hefestotech";
const ID_PRODUCTO = "815203e9-d676-44a0-94d8-273b7d7459f3";
const RUTAS = ["/", "/productos", `/producto/${ID_PRODUCTO}`, "/carrito", "/checkout", "/cuenta", "/admin", "/acerca"];
const CASOS = [
  { nombre: "360x640", w: 360, h: 640 },
  { nombre: "390x844", w: 390, h: 844 },
  { nombre: "640x480-zoom200", w: 640, h: 480 },
  { nombre: "768x1024", w: 768, h: 1024 },
  { nombre: "844x390-horizontal", w: 844, h: 390 },
  { nombre: "1024x768", w: 1024, h: 768 },
  { nombre: "1280x800", w: 1280, h: 800 },
  { nombre: "1920x1080", w: 1920, h: 1080 },
];

const DIR = "C:/Users/isaia/AppData/Local/Temp/opencode/resp-antes";
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const filas = [];
  for (const c of CASOS) {
    const ctx = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      isMobile: c.w < 768,
      hasTouch: c.w < 768,
    });
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", (e) => errores.push("pageerror: " + String(e).split("\n")[0].slice(0, 140)));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push("console: " + m.text().slice(0, 140));
    });
    for (const ruta of RUTAS) {
      await page.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => {
        const vw = window.innerWidth;
        const desbordan = [];
        document.querySelectorAll("body *").forEach((el) => {
          const tag = el.tagName.toLowerCase();
          if (["svg", "path", "circle", "rect", "line", "polyline"].includes(tag)) return;
          if (getComputedStyle(el).position === "fixed") return;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) {
            const cls = typeof el.className === "string" && el.className
              ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".")
              : tag;
            if (desbordan.length < 6) desbordan.push(`${cls} L=${Math.round(r.left)} R=${Math.round(r.right)}`);
          }
        });
        const chicos = [];
        document.querySelectorAll("a, button, input, select, [role=button]").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
            const cls = typeof el.className === "string" && el.className
              ? "." + el.className.split(" ").filter(Boolean).slice(0, 1).join(".")
              : el.tagName;
            if (chicos.length < 6) chicos.push(`${el.tagName}${cls} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        });
        return {
          overflowX: document.documentElement.scrollWidth > vw + 1,
          scrollW: document.documentElement.scrollWidth,
          desbordan,
          tactilChico: chicos,
        };
      });
      let axe = { violaciones: "n/a" };
      try {
        const res = await new AxeBuilder({ page }).analyze();
        axe = { violaciones: res.violations.map((v) => `${v.id}(${v.nodes.length})`).slice(0, 8) };
      } catch (e) { axe = { violaciones: "axe-error" }; }
      filas.push({ caso: c.nombre, ruta, ...info, axe: axe.violaciones, errores });
      await page.screenshot({ path: path.join(DIR, `${c.nombre}${ruta.replace(/\//g, "_")}.png`) });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync("C:/Users/isaia/AppData/Local/Temp/opencode/resp-diagnostico.json", JSON.stringify(filas, null, 1));
  console.log("COMBOS:", filas.length);
  for (const f of filas) {
    if (f.overflowX || f.desbordan.length || f.tactilChico.length || f.errores.length) {
      console.log(`[${f.caso} ${f.ruta}] overflow=${f.overflowX} desb=${JSON.stringify(f.desbordan)} tactil=${JSON.stringify(f.tactilChico)} axe=${JSON.stringify(f.axe)} err=${JSON.stringify(f.errores)}`);
    }
  }
  console.log("LIMPIOS:", filas.filter((f) => !f.overflowX && !f.desbordan.length && !f.tactilChico.length && !f.errores.length).length + "/" + filas.length);
})();
