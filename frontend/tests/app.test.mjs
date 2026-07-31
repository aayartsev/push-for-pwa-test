import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");

test("обязательные файлы фронтенда существуют", () => {
  for (const name of [
    "index.html",
    "app.js",
    "styles.css",
    "manifest.webmanifest",
    "sw.js",
    "libs/owl.iife.js",
  ]) {
    const content = readFileSync(join(frontendRoot, name), "utf8");
    assert.ok(content.length > 0, `${name} не должен быть пустым`);
  }
});

test("index.html не использует CDN для библиотек", () => {
  const html = readFileSync(join(frontendRoot, "index.html"), "utf8");
  assert.doesNotMatch(html, /cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/);
  assert.match(html, /\/static\/libs\/owl\.iife\.js/);
});

test("getAppTitle возвращает название приложения", async () => {
  const moduleUrl = pathToFileURL(join(frontendRoot, "app.js")).href;
  const mod = await import(moduleUrl);
  assert.equal(mod.getAppTitle(), "PWA Push Messenger");
});

test("index.html ссылается на стили, манифест и app.js", () => {
  const html = readFileSync(join(frontendRoot, "index.html"), "utf8");
  assert.match(html, /styles\.css/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /app\.js/);
  assert.match(html, /id="app"/);
});

test("manifest содержит display standalone и иконки 192/512", () => {
  const manifest = JSON.parse(
    readFileSync(join(frontendRoot, "manifest.webmanifest"), "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "ru");
  const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(sizes.has("192x192"));
  assert.ok(sizes.has("512x512"));
});

test("service worker обрабатывает fetch для installability", () => {
  const sw = readFileSync(join(frontendRoot, "sw.js"), "utf8");
  assert.match(sw, /addEventListener\(\s*["']fetch["']/);
});
