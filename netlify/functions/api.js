const serverless = require('serverless-http');
const { app } = require('../../backend/server.js');

app.get('/test-env', (req, res) => {
  res.json({
    url: typeof process.env.DATABASE_URL,
    urlValue: process.env.DATABASE_URL ? 'set' : 'not set',
    direct: typeof process.env.DIRECT_URL,
    jwt: typeof process.env.JWT_SECRET
  });
});

module.exports.handler = serverless(app, {
  basePath: '/.netlify/functions'
});
