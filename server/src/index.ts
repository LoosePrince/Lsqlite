import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { SiteStore } from './site-store.js';

const config = loadConfig();
const store = new SiteStore(config);
const app = createApp({ config, store });

const server = app.listen(config.PORT, () => {
  console.log(`Lsqlite listening on http://localhost:${config.PORT}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);