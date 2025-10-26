const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

const sqlConfig = {
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'YourStrong@Passw0rd',
  server: process.env.SQL_SERVER || 'localhost',
  database: process.env.SQL_DATABASE || 'master',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

let poolPromise;

const getPool = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig).catch(err => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-1' });
});

app.get('/ready', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

app.get('/api/data', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT GETDATE() as currentDateTime, @@VERSION as sqlVersion');
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/init', async (req, res) => {
  try {
    const pool = await getPool();

    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SampleData')
        DROP TABLE SampleData
    `);

    await pool.request().query(`
      CREATE TABLE SampleData (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TimeGenerated DATETIME DEFAULT GETDATE(),
        [Key] NVARCHAR(255) NOT NULL,
        [Value] NVARCHAR(MAX)
      )
    `);

    res.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ success: false, error: 'Both key and value required' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('key', sql.NVarChar, key)
      .input('value', sql.NVarChar, value)
      .query('INSERT INTO SampleData ([Key], [Value]) OUTPUT INSERTED.* VALUES (@key, @value)');

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Insert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM SampleData ORDER BY Id DESC');
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM SampleData WHERE Id = @id');

    if (result.rowsAffected[0] > 0) {
      res.json({ success: true, message: `Deleted record ${id}` });
    } else {
      res.status(404).json({ success: false, error: 'Record not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API 1 listening on port ${port}`);
  console.log(`SQL Server: ${sqlConfig.server}`);
});
