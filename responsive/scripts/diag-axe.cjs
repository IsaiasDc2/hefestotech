const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");
const { AxeBuilder } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/@axe-core/playwright");

(async () => {
  const browser = await chromium.launch();
  for (const [ruta, w] of [["/", 390], ["/productos", 390], ["/checkout", 390], ["/cuenta", 390]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: 844 } })).newPage();
    await page.goto("http://localhost:5199/hefestotech" + ruta, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const res = await new AxeBuilder({ page }).analyze();
    console.log("=== " + ruta + " ===");
    for (const v of res.violations) {
      console.log(`- ${v.id}: ${v.help.slice(0, 80)}`);
      v.nodes.slice(0, 4).forEach((n) => console.log("   " + n.html.slice(0, 130)));
    }
  }
  await browser.close();
})();
