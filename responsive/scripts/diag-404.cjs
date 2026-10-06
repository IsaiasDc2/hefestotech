const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const mal = {};
  page.on("response", (r) => {
    if (r.status() >= 400) {
      const u = r.url().replace("http://localhost:5199", "");
      mal[`${r.status()} ${r.request().method()} ${u.slice(0, 120)}`] = (mal[`${r.status()} ${r.request().method()} ${u.slice(0, 120)}`] || 0) + 1;
    }
  });
  for (const ruta of ["/", "/productos", "/producto/815203e9-d676-44a0-94d8-273b7d7459f3", "/carrito", "/checkout", "/cuenta", "/admin", "/acerca"]) {
    await page.goto("http://localhost:5199/hefestotech" + ruta, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);
  }
  console.log(JSON.stringify(mal, null, 1));
  await browser.close();
})();
