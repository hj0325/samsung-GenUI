const http = require('http');
const next = require('next');

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.BIND_HOST || '127.0.0.1';
const dev = process.env.NODE_ENV !== 'production';

async function start() {
  const app = next({ dev, dir: __dirname });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer((req, res) => handle(req, res));
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Samsung OneUI Design System');
    console.log(`  Next.js running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log('');
  });
}

start().catch((error) => {
  console.error('[server] failed to start next runtime:', error);
  process.exit(1);
});
