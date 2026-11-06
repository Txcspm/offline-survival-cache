import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(root, "dist/platform-evaluation");
const manifest = JSON.parse(
  readFileSync(path.join(output, "manifest.json"), "utf8"),
);
const servers = [];
const results = [];
let browser;
async function serve(folder, port) {
  const server = spawn(
    "python3",
    [
      "-m",
      "http.server",
      String(port),
      "--bind",
      "127.0.0.1",
      "--directory",
      folder,
    ],
    { stdio: "ignore" },
  );
  servers.push(server);
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${port}/`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 10000 },
    )
    .toBe(200);
}
try {
  await serve(path.join(output, "starlight/dist"), 8260);
  await serve(path.join(output, "tiddlywiki/output"), 8261);
  browser = await chromium.launch({
    executablePath: process.env.CI ? undefined : "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8260/");
  await page
    .getByRole("link", { name: "Water Collection & Treatment", exact: true })
    .last()
    .click();
  await page
    .getByRole("link", {
      name: "Boil and protect emergency drinking water",
      exact: true,
    })
    .last()
    .click();
  await expect(page.locator("h1")).toHaveText(
    "Boil and protect emergency drinking water",
  );
  await expect(
    page.getByRole("link", { name: "Scope and stop conditions", exact: true }),
  ).toBeVisible();
  results.push(
    "Starlight: category-to-article navigation and native article contents passed",
  );
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  await page.locator("dialog input").fill("rolling boil");
  await expect(page.locator("dialog")).toContainText(
    "Boil and protect emergency drinking water",
  );
  results.push(
    "Starlight: native Pagefind body-text search and result passage passed",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Menu/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  results.push("Starlight: mobile menu and no horizontal overflow passed");
  expect(errors).toEqual([]);
  const wiki = await context.newPage();
  await wiki.goto("http://127.0.0.1:8261/offline-survival-cache.html");
  await wiki.waitForFunction(() => !!window.$tw?.wiki);
  expect(
    await wiki.evaluate(() => $tw.wiki.filterTiddlers("[has[osc-id]]").length),
  ).toBe(manifest.article_count);
  expect(
    await wiki.evaluate(() =>
      $tw.wiki.filterTiddlers("[has[osc-id]search[rolling boil]]"),
    ),
  ).toContain("Boil and protect emergency drinking water (OSC-1004)");
  await wiki
    .getByRole("link", { name: "Field manuals", exact: true })
    .first()
    .click();
  await wiki
    .getByRole("link", {
      name: "Boil and protect emergency drinking water",
      exact: true,
    })
    .first()
    .click();
  await expect(wiki.locator(".tc-tiddler-body").last()).toContainText(
    "Scope and stop conditions",
  );
  results.push(
    "TiddlyWiki: all article IDs, native full-text search and two-link manual navigation passed",
  );
  await wiki.evaluate(() =>
    $tw.wiki.addTiddler({
      title: "Native export test",
      text: "A portable personal note",
      type: "text/plain",
      tags: ["Personal"],
    }),
  );
  const html = await wiki.evaluate(() =>
    $tw.wiki.renderTiddler("text/plain", "$:/core/save/all"),
  );
  wiki.on("dialog", (dialog) => dialog.accept());
  await wiki.reload();
  await wiki.waitForFunction(() => !!window.$tw?.wiki);
  expect(
    await wiki.evaluate(() => $tw.wiki.getTiddlerText("Native export test")),
  ).toBe("A portable personal note");
  results.push(
    "TiddlyWiki: official browser-storage plugin retained a new personal note across reload",
  );
  const offline = await browser.newContext();
  await offline.setOffline(true);
  await offline.route("http://127.0.0.1:8261/saved-wiki.html", (route) =>
    route.fulfill({ body: html, contentType: "text/html" }),
  );
  const restored = await offline.newPage();
  await restored.goto("http://127.0.0.1:8261/saved-wiki.html");
  await restored.waitForFunction(() => !!window.$tw?.wiki);
  expect(
    await restored.evaluate(() =>
      $tw.wiki.getTiddlerText("Native export test"),
    ),
  ).toBe("A portable personal note");
  expect(
    await restored.evaluate(
      () => $tw.wiki.filterTiddlers("[has[osc-id]]").length,
    ),
  ).toBe(manifest.article_count);
  results.push(
    "TiddlyWiki: native saved HTML retained articles and edits in a clean profile with network disabled (artifact supplied by test route)",
  );
  writeFileSync(
    path.join(output, "smoke-results.json"),
    JSON.stringify(
      {
        passed: results,
        limitations: [
          "Starlight offline install and personal-data migration are not implemented in this reading evaluation.",
          "Managed browser blocks file URLs; TiddlyWiki saved HTML was tested via a routed local artifact, not an actual file URL.",
          "No Kiwix archive was downloaded or editorially assessed.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  for (const result of results) console.log("PASS", result);
} finally {
  await browser?.close();
  for (const server of servers) server.kill("SIGTERM");
}
