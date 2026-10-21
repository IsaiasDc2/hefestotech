const { chromium } = require("C:/Users/isaia/OneDrive/Desktop/hefestotech/ecomers/client/node_modules/playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const urls404 = [];
  page.on("response", (r) => {
    if (r.status() === 404) urls404.push(`${r.request().method()} ${r.url().slice(0, 130)}`);
  });
  await page.goto("http://localhost:5199/hefestotech/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const diag = await page.evaluate(() => {
    const bodyCS = getComputedStyle(document.body);
    const htmlCS = getComputedStyle(document.documentElement);
    const root = document.getElementById("root");
    let culpable = null;
    let el = document.body;
    while (el && el !== document.documentElement) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const cs = getComputedStyle(el);
        culpable = `${el.tagName}.${typeof el.className === "string" ? el.className.split(" ")[0] : ""} scrollW=${el.scrollWidth} clientW=${el.clientWidth} pos=${cs.position} ml=${cs.marginLeft}`;
        break;
      }
      el = el.parentElement;
    }
    const deep = [];
    document.querySelectorAll("main *, footer *").forEach((x) => {
      if (x.scrollWidth > x.clientWidth + 1 && x.children.length > 0) {
        const cls = typeof x.className === "string" && x.className
          ? "." + x.className.split(" ").filter(Boolean).slice(0, 2).join(".")
          : x.tagName;
        if (deep.length < 8) deep.push(`${cls} scrollW=${x.scrollWidth} clientW=${x.clientWidth}`);
      }
    });
    return {
      bodyMargin: bodyCS.margin,
      htmlMargin: htmlCS.margin,
      bodyRectL: Math.round(document.body.getBoundingClientRect().left),
      rootRectL: root ? Math.round(root.getBoundingClientRect().left) : null,
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      culpable,
      deep,
    };
  });
  console.log(JSON.stringify(diag, null, 1));
  console.log("404s:", JSON.stringify([...new Set(urls404)].slice(0, 10), null, 1));
  await browser.close();
})();
