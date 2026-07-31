import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("README описывает три TLS-профиля", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  assert.match(readme, /docker-compose\.local\.yml/);
  assert.match(readme, /docker-compose\.https\.yml/);
  assert.match(readme, /docker-compose\.public\.yml/);
  assert.match(readme, /mkcert/);
  assert.match(readme, /Let's Encrypt|Lets Encrypt|автоматический HTTPS|Let's Encrypt/i);
});

test("Caddyfile.https использует файловые сертификаты", () => {
  const file = readFileSync(join(root, "caddy", "Caddyfile.https"), "utf8");
  assert.match(file, /tls \/certs\/pwa\.lan\.pem/);
  assert.match(file, /tls \/certs\/push\.lan\.pem/);
});
