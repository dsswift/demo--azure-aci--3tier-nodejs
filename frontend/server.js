const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const API1_HOST = process.env.API1_URL || 'http://localhost:3001';
const API2_HOST = process.env.API2_URL || 'http://localhost:3002';

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/api1') || req.url.startsWith('/api2')) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.url.startsWith('/api1') || req.url.startsWith('/api2')) {
    return next();
  }
  express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 50000 })(req, res, next);
});

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'frontend' });
});

app.get('/api/config', (req, res) => {
  res.json({
    api1Url: '/api1',
    api2Url: '/api2'
  });
});

app.use('/api1', createProxyMiddleware({
  target: API1_HOST,
  changeOrigin: true,
  pathRewrite: { '^/api1': '' },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying to API1: ${API1_HOST}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('API1 proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}));

app.use('/api2', createProxyMiddleware({
  target: API2_HOST,
  changeOrigin: true,
  pathRewrite: { '^/api2': '' },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying to API2: ${API2_HOST}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('API2 proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend listening on port ${port}`);
  console.log(`API 1: ${API1_HOST}`);
  console.log(`API 2: ${API2_HOST}`);
});
