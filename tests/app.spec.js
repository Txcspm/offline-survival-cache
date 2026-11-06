const { test, expect, chromium } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
test.afterEach(async ({ request }) => {
  await request.post("/__fault", { data: {} });
});
async function ready(page) {
  await page.goto("/");
  const expected = require("../knowledge/catalog.json").total + 3;
  await page.waitForFunction(
    (count) =>
      document.querySelector("#articleCount").textContent === String(count),
    expected,
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForFunction(() =>
    document
      .querySelector("#offlineState")
      .textContent.includes("synchronized"),
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
  await expect(page.locator("#OSC-0030 h1")).toHaveText(
    "Household emergency supply inventory",
  );
  await expect(page.locator("#OSC-0030")).toContainText("draft");
  await page.getByRole("link", { name: /Back to the library/ }).click();
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
    await page.getByRole("link", { name: /Field Notes/ }).click();
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
  await page.getByRole("link", { name: /Field Notes/ }).click();
  await page.getByLabel("Field notes").fill("Original notes");
  await page.getByRole("button", { name: "Save Notes", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Notes", exact: true }).click();
  const file = await download;
  const backup = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  expect(backup.notes).toBe("Original notes");
  await page.locator("#notesFile").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"wrong"}'),
  });
  await expect(page.locator("#fieldNotes")).toHaveValue("Original notes");
  page.on("dialog", (d) => d.accept());
  await page.locator("#notesFile").setInputFiles({
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
    document
      .querySelector("#offlineState")
      .textContent.includes("synchronized"),
  );
  await context.setOffline(true);
  await page.goto("/_site/#OSC-0030");
  await expect(page.locator("#OSC-0030")).toContainText(
    "Household emergency supply inventory",
  );
});

test("mobile layout and individual article printing preserve review warnings", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await ready(page);
  await page.goto("/#OSC-0030");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const popupPromise = page.waitForEvent("popup");
  await page
    .locator("#OSC-0030")
    .getByRole("button", { name: "Print this guide" })
    .click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText(
    "Unverified reference material",
  );
  await expect(popup.locator("body")).toContainText("OSC-0030");
});

test("category links preserve ampersands and multiword local search finds authored text", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("link", { name: /Water & treatment.*EXPLORE/i })
    .first()
    .click();
  await expect(page.getByLabel("Filter by category")).toHaveValue(
    "Water Collection & Treatment",
  );
  await page.getByLabel("Search articles").fill("rolling boil");
  await expect(page.locator("#results")).toContainText(
    "Boil and protect emergency drinking water",
  );
  await expect(page.locator("#results")).not.toContainText(
    "Make a portable-generator",
  );
});

test("saved reading and annotations survive reload and are exported in full backup", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#OSC-1004");
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  await page
    .getByLabel("Article annotation")
    .fill("Our altitude is above 6,500 feet; review local guidance.");
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Article annotation")).toHaveValue(
    "Our altitude is above 6,500 feet; review local guidance.",
  );
  await page.getByRole("link", { name: /Saved reading/ }).click();
  await expect(page.locator("#savedArticles")).toContainText(
    "Boil and protect emergency drinking water",
  );
  await page.goto("/#archive");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export full backup", exact: true })
    .click();
  const file = await downloading;
  const data = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
  expect(data.workspace.bookmarks).toContain("OSC-1004");
  expect(data.workspace.annotations["OSC-1004"]).toContain("altitude");
  expect(data.format).toBe("osc-backup");
});

test("full backup restore is explicit and rejects malformed annotation records", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#archive");
  await page.evaluate(() =>
    localStorage.setItem("osc_field_notes_v1", "Keep original notebook"),
  );
  const invalid = {
    format: "osc-backup",
    version: 2,
    notes: "Replacement",
    workspace: {
      version: 2,
      bookmarks: [],
      recent: [],
      annotations: { __invalid__: "bad" },
      theme: "light",
    },
  };
  await page.locator("#backupFile").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.locator("#backupMessage")).toContainText("Restore failed");
  expect(
    await page.evaluate(() => localStorage.getItem("osc_field_notes_v1")),
  ).toBe("Keep original notebook");
  const good = {
    ...invalid,
    workspace: {
      version: 2,
      bookmarks: ["OSC-1004"],
      recent: ["OSC-1004"],
      annotations: { "OSC-1004": "Restored annotation" },
      theme: "dark",
    },
  };
  page.once("dialog", (d) => d.accept());
  await page.locator("#backupFile").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(good)),
  });
  await expect(page.locator("#backupMessage")).toContainText(
    "restored and saved",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#fieldNotes")).toHaveValue("Replacement");
  await page.goto("/#OSC-1004");
  await expect(page.getByLabel("Article annotation")).toHaveValue(
    "Restored annotation",
  );
});

test("full restore rolls back the workspace if writing the notebook fails", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/#archive");
  await page.evaluate(() => {
    localStorage.setItem("osc_field_notes_v1", "Original");
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "osc_field_notes_v1" && value === "New notebook")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  const before = await page.evaluate(() =>
    localStorage.getItem("osc_workspace_v2"),
  );
  page.once("dialog", (d) => d.accept());
  await page.locator("#backupFile").setInputFiles({
    name: "restore.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "osc-backup",
        version: 2,
        notes: "New notebook",
        workspace: {
          version: 2,
          bookmarks: ["OSC-1004"],
          recent: [],
          annotations: {},
          theme: "dark",
        },
      }),
    ),
  });
  await expect(page.locator("#backupMessage")).toContainText("Restore failed");
  expect(
    await page.evaluate(() => localStorage.getItem("osc_workspace_v2")),
  ).toBe(before);
  expect(
    await page.evaluate(() => localStorage.getItem("osc_field_notes_v1")),
  ).toBe("Original");
});

test("unsaved article annotations can cancel navigation", async ({ page }) => {
  await ready(page);
  await page.goto("/#OSC-1004");
  await page.getByLabel("Article annotation").fill("Do not lose this draft");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("link", { name: /Field Notes/ }).click();
  await expect(page).toHaveURL(/#OSC-1004$/);
  await expect(page.getByLabel("Article annotation")).toHaveValue(
    "Do not lose this draft",
  );
  await page
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
});

test("a fresh profile receives an explicit error rather than a false offline-ready claim when a module is missing", async ({
  page,
  request,
}) => {
  await request.post("/__fault", {
    data: { path: "/knowledge/modules/osc_field_manual_1001_1030.json" },
  });
  await page.goto("/");
  await expect(page.locator("#loadError")).toContainText("could not be loaded");
  await expect(page.locator("#offlineBadge")).not.toHaveText(
    "● Available offline",
  );
});

test("v0.7 to v0.8 migration preserves existing notes through an offline browser restart", async ({
  request,
}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "osc-migration-"));
  let context;
  const launch = () =>
    chromium.launchPersistentContext(dir, {
      executablePath: process.env.CI ? undefined : "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    await request.post("/__fault", { data: { legacy: true } });
    context = await launch();
    let page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/");
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.waitForFunction(() =>
      document.querySelector("#offlineState").textContent.includes("cached"),
    );
    await page.evaluate(() =>
      localStorage.setItem(
        "osc_field_notes_v1",
        "Notebook from the original release",
      ),
    );
    await request.post("/__fault", { data: {} });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const worker = navigator.serviceWorker.controller;
            if (!worker || worker.state !== "activated") return false;
            return new Promise((resolve) => {
              const channel = new MessageChannel();
              const timer = setTimeout(() => resolve(false), 1000);
              channel.port1.onmessage = (e) => {
                clearTimeout(timer);
                channel.port1.close();
                resolve(e.data.ready && e.data.version === "osc-core-v0.8.0");
              };
              worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [
                channel.port2,
              ]);
            });
          }),
        { timeout: 20000 },
      )
      .toBe(true);
    // The existing release tells users to reload after a shell update.
    await page.reload();
    await expect(page.locator(".brand")).toContainText("SURVIVAL");
    await page.waitForFunction(() =>
      document
        .querySelector("#offlineState")
        .textContent.includes("synchronized"),
    );
    await context.close();
    context = await launch();
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/#OSC-1004");
    await expect(page.locator("#OSC-1004 h1")).toHaveText(
      "Boil and protect emergency drinking water",
    );
    await expect(page.locator("#fieldNotes")).toHaveValue(
      "Notebook from the original release",
    );
  } finally {
    await context?.close();
    fs.rmSync(dir, { recursive: true, force: true });
    await request.post("/__fault", { data: {} });
  }
});

test("corrupt reading-list storage never hides or overwrites an existing notebook", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("osc_workspace_v2", "{unreadable record");
      localStorage.setItem(
        "osc_field_notes_v1",
        "Preserve these original notes",
      );
      sessionStorage.setItem("seeded", "yes");
    }
  });
  await ready(page);
  await expect(page.locator("#fieldNotes")).toHaveValue(
    "Preserve these original notes",
  );
  await page.goto("/#OSC-1004");
  await page
    .getByRole("button", { name: "Save for later", exact: true })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("osc_workspace_v2")),
  ).toBe("{unreadable record");
  await page.goto("/#archive");
  await expect(
    page.getByRole("button", { name: "Export unreadable workspace record" }),
  ).toBeVisible();
});
