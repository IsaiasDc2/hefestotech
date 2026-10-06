const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  for (const [ruta, w] of [["/admin", 1280], ["/checkout", 390], ["/productos", 390], ["/", 390]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: 800 } })).newPage();
    await page.goto("http://localhost:5199/hefestotech" + ruta, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const list = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("a, button, input, select").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        if (r.width >= 44 && r.height >= 44) return;
        if (getComputedStyle(el).visibility === "hidden") return;
        const cls = typeof el.className === "string" && el.className ? "." + el.className.split(" ").filter(Boolean).join(".") : "";
        out.push(`${el.tagName}${cls} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
      });
      return out.slice(0, 20);
    });
    console.log("=== " + ruta + " @" + w + " ===");
    list.forEach((l) => console.log("  " + l));
  }
  await browser.close();
})();
