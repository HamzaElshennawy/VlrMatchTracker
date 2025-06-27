const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.NEXT_PORT || 3000;

console.log('Starting VLR.gg Scraper API with Next.js...');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 VLR.gg Scraper API ready on http://${hostname}:${port}`);
      console.log('📋 Available endpoints:');
      console.log('  - GET  /api/matches (all matches)');
      console.log('  - GET  /api/matches/upcoming');
      console.log('  - GET  /api/matches/live');
      console.log('  - GET  /api/matches/results');
      console.log('  - GET  /api/match/[id] (detailed match data)');
      console.log('  - POST /api/scrape (trigger scraping)');
      console.log('  - GET  /api/teams');
      console.log('  - GET  /api/tournaments');
    });
});