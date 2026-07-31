#!/usr/bin/env node
/**
 * Создаёт (или находит) Site в PushHive и печатает apiKey в stdout (последняя строка).
 * Запускается внутри контейнера pushhive:
 *   node /scripts/create-site.js <name> <domain>
 */
// MONGODB_URI уже в env контейнера; dotenv не нужен (скрипт монтируется вне /app).
const mongoose = require("/app/node_modules/mongoose");
const Site = require("/app/models/Site");

const name = process.argv[2] || "PWA Messenger";
const domain = process.argv[3] || "localhost:8000";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  let site = await Site.findOne({ domain });
  if (!site) {
    site = new Site({
      name,
      domain,
      welcomeNotification: {
        enabled: false,
        title: "Welcome",
        body: "Subscribed",
        url: "",
      },
      promptConfig: {
        delay: 0,
        style: "native",
        title: "Notifications",
        message: "Enable push",
        allowButtonText: "Allow",
        denyButtonText: "Later",
      },
    });
    await site.save();
    console.error(`Created site ${name} (${domain})`);
  } else {
    console.error(`Site already exists for domain ${domain}`);
  }
  console.log(site.apiKey);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
