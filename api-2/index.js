const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Azure Storage configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
const containerName = process.env.AZURE_CONTAINER_NAME || 'demo-container';

let blobServiceClient;
let containerClient;

const initializeStorage = async () => {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);

    // Create container if it doesn't exist
    await containerClient.createIfNotExists({
      access: 'blob'
    });

    console.log(`Connected to storage container: ${containerName}`);
  } catch (error) {
    console.error('Storage initialization error:', error.message);
  }
};

// Initialize storage on startup
initializeStorage();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-2' });
});

// Readiness check endpoint (checks storage connection)
app.get('/ready', async (req, res) => {
  try {
    if (!containerClient) {
      throw new Error('Container client not initialized');
    }
    // Test connection by checking if container exists
    const exists = await containerClient.exists();
    res.json({ status: 'ready', storage: exists ? 'connected' : 'container not found' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// List all blobs
app.get('/api/files', async (req, res) => {
  try {
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType
      });
    }
    res.json({ success: true, files: blobs });
  } catch (error) {
    console.error('List blobs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload a file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const blobName = `${Date.now()}-${req.file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file buffer
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype
      }
    });

    res.json({
      success: true,
      file: {
        name: blobName,
        size: req.file.size,
        type: req.file.mimetype,
        url: blockBlobClient.url
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload text content as blob
app.post('/api/content', async (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ success: false, error: 'Filename and content required' });
    }

    const blobName = `${Date.now()}-${filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: {
        blobContentType: 'text/plain'
      }
    });

    res.json({
      success: true,
      file: {
        name: blobName,
        size: Buffer.byteLength(content),
        url: blockBlobClient.url
      }
    });
  } catch (error) {
    console.error('Content upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download a file
app.get('/api/files/:blobName', async (req, res) => {
  try {
    const { blobName } = req.params;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const downloadResponse = await blockBlobClient.download();
    const contentType = downloadResponse.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${blobName}"`);

    downloadResponse.readableStreamBody.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a file
app.delete('/api/files/:blobName', async (req, res) => {
  try {
    const { blobName } = req.params;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();

    res.json({ success: true, message: `Deleted ${blobName}` });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API 2 listening on port ${port}`);
  console.log(`Storage container: ${containerName}`);
});
