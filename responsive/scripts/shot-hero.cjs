const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  for (const [w, h, name] of [[1280, 800, "hero-1280"], [390, 844, "hero-390"]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    await page.goto("http://localhost:5199/hefestotech/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `C:/Users/isaia/AppData/Local/Temp/opencode/${name}.png` });
    await page.close();
  }
  await browser.close();
  console.log("OK");
})();
