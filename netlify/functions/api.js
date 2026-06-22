const express = require('express');
const serverless = require('serverless-http');
const { app } = require('../../backend/server.js');

const wrapperApp = express();

wrapperApp.use((req, res, next) => {
  console.log('[Netlify DEBUG] Original req.url:', req.url);
  // Netlify rewrites the URL to include the function path. We need to strip it and put /api back
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  console.log('[Netlify DEBUG] Rewritten req.url:', req.url);
  next();
});

wrapperApp.use(app);

module.exports.handler = serverless(wrapperApp);
