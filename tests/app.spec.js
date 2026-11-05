const { test, expect, chromium } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
test.afterEach(async ({ request }) => {
  await request.post("/__fault", { data: {} });
});
async function ready(page) {
  await page.goto("/");
  const expected = require('../knowledge/catalog.json').total + 3;
  await page.waitForFunction(
    count => document.querySelector("#articleCount").textContent === String(count), expected,
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForFunction(() =>
    document.querySelector("#offlineState").textContent.includes("synchronized"),
  );
}
async function update(page) {
  return page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const c = new MessageChannel();
      c.port1.onmessage = (e) => resolve(e.data);
      r.active.postMessage({ type: "UPDATE_LIBRARY" }, [c.port2]);
    });
  });
}
test("startup, search, review filters and article navigation", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#OSC-0030");
  await expect(page.locator("#OSC-0030 details")).toHaveAttribute("open", "");
  await expect(page.locator("#OSC-0030")).toContainText("DRAFT");
  await page.getByLabel("Filter by review status").selectOption("approved");
  await expect(page.locator("#results")).toContainText("0 matching");
});
test("notes survive browser restart and offline article loading", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osc-"));
  let context;
  const launch = () =>
    chromium.launchPersistentContext(dir, {
      executablePath: process.env.CI ? undefined : "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    context = await launch();
    let page = await context.newPage();
    await ready(page);
    await page
      .getByRole("button", { name: "Field Notes", exact: true })
      .click();
    await page.getByLabel("Field notes").fill("Preserve my field observations");
    await page.getByRole("button", { name: "Save Notes", exact: true }).click();
    await context.close();
    context = await launch();
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/#OSC-0030");
    await expect(page.locator("#OSC-0030")).toContainText(
      "Household emergency supply inventory",
    );
    await expect(page.locator("#fieldNotes")).toHaveValue(
      "Preserve my field observations",
    );
  } finally {
    await context?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("failed update preserves committed generation; valid update commits", async ({
  page,
  request,
}) => {
  await ready(page);
  const before = await page.evaluate(
    async () =>
      await (
        await (
          await caches.open("osc-library-pointer")
        ).match(new URL("./active-library", location.href))
      ).text(),
  );
  await request.post("/__fault", {
    data: { path: "/knowledge/modules/osc_0030_inventory_test.json" },
  });
  expect((await update(page)).ok).toBe(false);
  const after = await page.evaluate(
    async () =>
      await (
        await (
          await caches.open("osc-library-pointer")
        ).match(new URL("./active-library", location.href))
      ).text(),
  );
  expect(after).toBe(before);
  await request.post("/__fault", {
    data: {
      path: "/knowledge/modules/osc_0030_inventory_test.json",
      status: 200,
    },
  });
  const corrupt = await update(page);
  expect(corrupt.ok).toBe(false);
  expect(corrupt.error).toContain("checksum");
  await request.post("/__fault", { data: {} });
  expect((await update(page)).ok).toBe(true);
});

test("backup export, rejected restore and explicit valid restore", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Field Notes", exact: true }).click();
  await page.getByLabel("Field notes").fill("Original notes");
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Notes", exact: true }).click();
  const file = await download;
  const backup = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  expect(backup.notes).toBe("Original notes");
  await page
    .locator("#notesFile")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"wrong"}'),
    });
  await expect(page.locator("#fieldNotes")).toHaveValue("Original notes");
  page.on("dialog", (d) => d.accept());
  await page
    .locator("#notesFile")
    .setInputFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "osc-notes",
          version: 1,
          notes: "Restored notes",
        }),
      ),
    });
  await expect(page.locator("#fieldNotes")).toHaveValue("Restored notes");
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  await page.reload();
  await expect(page.locator("#fieldNotes")).toHaveValue("Restored notes");
});
test("published bundle starts under a subdirectory and works offline", async ({
  page,
  context,
}) => {
  await page.goto("/_site/");
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForFunction(() =>
    document.querySelector("#offlineState").textContent.includes("synchronized"),
  );
  await context.setOffline(true);
  await page.goto("/_site/#OSC-0030");
  await expect(page.locator("#OSC-0030")).toContainText(
    "Household emergency supply inventory",
  );
});

test('mobile layout and individual article printing preserve review warnings', async ({page,context}) => {
  await page.setViewportSize({width:390,height:844});
  await context.addInitScript(() => { window.print = () => {}; });
  await ready(page);
  await page.goto('/#OSC-0030');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const popupPromise=page.waitForEvent('popup');
  await page.locator('#OSC-0030').getByRole('button',{name:'Print this guide'}).click();
  const popup=await popupPromise;
  await expect(popup.locator('body')).toContainText('Unverified reference material');
  await expect(popup.locator('body')).toContainText('OSC-0030');
});
