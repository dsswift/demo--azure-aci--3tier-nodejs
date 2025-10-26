let config = {
    api1Url: 'http://localhost:3001',
    api2Url: 'http://localhost:3002'
};

let api1Healthy = false;
let api2Healthy = false;
const requestLogs = [];

function logRequest(method, url, requestBody, responseStatus, responseBody, error) {
    const timestamp = new Date().toISOString();
    const log = { timestamp, method, url, requestBody, responseStatus, responseBody, error };

    requestLogs.unshift(log);
    if (requestLogs.length > 50) requestLogs.pop();
    updateRequestLog();
}

function updateRequestLog() {
    const logDiv = document.getElementById('request-log');

    if (requestLogs.length === 0) {
        logDiv.innerHTML = '<div class="log-empty">No requests yet. Interact with the APIs above to see request/response logs here.</div>';
        return;
    }

    logDiv.innerHTML = requestLogs.map(log => {
        const statusClass = log.error ? 'error' : (log.responseStatus >= 200 && log.responseStatus < 300) ? 'success' : 'warning';
        const time = new Date(log.timestamp).toLocaleTimeString();

        return `
            <div class="log-entry ${statusClass}">
                <div class="log-time">${time}</div>
                <div class="log-details">
                    <div class="log-request">
                        <strong>${log.method}</strong> ${log.url}
                        ${log.requestBody ? `<pre class="log-body">${JSON.stringify(log.requestBody, null, 2)}</pre>` : ''}
                    </div>
                    <div class="log-response">
                        ${log.error ?
                            `<span class="log-status error">ERROR</span> ${log.error}` :
                            `<span class="log-status">${log.responseStatus}</span>`
                        }
                        ${log.responseBody ? `<pre class="log-body">${JSON.stringify(log.responseBody, null, 2)}</pre>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function clearLogs() {
    requestLogs.length = 0;
    updateRequestLog();
}

async function fetchWithLogging(url, options = {}) {
    const method = options.method || 'GET';
    let requestBody = null;

    if (options.body && typeof options.body === 'string') {
        try {
            requestBody = JSON.parse(options.body);
        } catch (e) {
            requestBody = options.body;
        }
    }

    try {
        const response = await fetch(url, options);
        let responseBody = null;

        try {
            const text = await response.text();
            responseBody = text ? JSON.parse(text) : null;
        } catch (e) {
            responseBody = null;
        }

        logRequest(method, url, requestBody, response.status, responseBody, null);

        return {
            ok: response.ok,
            status: response.status,
            json: async () => responseBody
        };
    } catch (error) {
        logRequest(method, url, requestBody, null, null, error.message);
        throw error;
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        updateSystemInfo();
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

function updateSystemInfo() {
    const api1Config = document.getElementById('api1-config');
    const api2Config = document.getElementById('api2-config');
    api1Config.textContent = `API 1 (SQL): ${config.api1Url}`;
    api2Config.textContent = `API 2 (Storage): ${config.api2Url}`;
}

async function checkApi1Health() {
    try {
        const response = await fetchWithLogging(`${config.api1Url}/ready`);
        const data = await response.json();

        const statusEl = document.getElementById('api1-status');
        if (data.status === 'ready') {
            statusEl.textContent = 'Healthy';
            statusEl.className = 'status healthy';
            api1Healthy = true;
        } else {
            statusEl.textContent = 'Unhealthy';
            statusEl.className = 'status unhealthy';
            api1Healthy = false;
        }

        displaySqlResult({ success: true, data });
    } catch (error) {
        document.getElementById('api1-status').className = 'status unhealthy';
        document.getElementById('api1-status').textContent = 'Unhealthy';
        api1Healthy = false;
        displaySqlResult({ success: false, error: error.message });
    }
}

async function initializeDatabase() {
    if (!api1Healthy) {
        alert('Check API 1 health first');
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api1Url}/api/init`, { method: 'POST' });
        const data = await response.json();
        displaySqlResult(data);
    } catch (error) {
        displaySqlResult({ success: false, error: error.message });
    }
}

async function insertData() {
    if (!api1Healthy) {
        alert('Check API 1 health first');
        return;
    }

    const key = document.getElementById('sql-key').value.trim();
    const value = document.getElementById('sql-value').value.trim();

    if (!key || !value) {
        alert('Enter both key and value');
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api1Url}/api/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        const data = await response.json();

        if (data.success) {
            displaySqlResult(data);
            document.getElementById('sql-key').value = '';
            document.getElementById('sql-value').value = '';
            setTimeout(() => fetchSqlData(), 500);
        } else {
            displaySqlResult(data);
        }
    } catch (error) {
        displaySqlResult({ success: false, error: error.message });
    }
}

async function fetchSqlData() {
    if (!api1Healthy) {
        alert('Check API 1 health first');
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api1Url}/api/items`);
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            displaySqlGrid(data.data);
        } else if (data.success && data.data && data.data.length === 0) {
            document.getElementById('sql-results').innerHTML = '<div class="empty-message">No data found</div>';
        } else {
            displaySqlResult(data);
        }
    } catch (error) {
        displaySqlResult({ success: false, error: error.message });
    }
}

function displaySqlGrid(data) {
    const resultsDiv = document.getElementById('sql-results');

    const tableHtml = `
        <table class="data-grid">
            <thead>
                <tr>
                    <th>Id</th>
                    <th>Time Generated</th>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        <td>${row.Id}</td>
                        <td>${new Date(row.TimeGenerated).toLocaleString()}</td>
                        <td>${row.Key}</td>
                        <td>${row.Value}</td>
                        <td>
                            <button onclick="deleteSqlRecord(${row.Id}, '${row.Key}')" class="delete-btn-small">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    resultsDiv.innerHTML = tableHtml;
}

async function deleteSqlRecord(id, key) {
    if (!api1Healthy) {
        alert('Check API 1 health first');
        return;
    }

    if (!confirm(`Delete record "${key}"?`)) {
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api1Url}/api/data/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            displaySqlResult({ success: true, message: `Deleted record ID ${id}` });
            setTimeout(() => fetchSqlData(), 500);
        } else {
            displaySqlResult(data);
        }
    } catch (error) {
        displaySqlResult({ success: false, error: error.message });
    }
}

function displaySqlResult(result) {
    const resultsDiv = document.getElementById('sql-results');

    if (result.success) {
        resultsDiv.innerHTML = `<div class="success">Success!</div><pre>${JSON.stringify(result, null, 2)}</pre>`;
    } else {
        resultsDiv.innerHTML = `<div class="error">Error: ${result.error}</div>`;
    }
}

async function checkApi2Health() {
    try {
        const response = await fetchWithLogging(`${config.api2Url}/ready`);
        const data = await response.json();

        const statusEl = document.getElementById('api2-status');
        if (data.status === 'ready') {
            statusEl.textContent = 'Healthy';
            statusEl.className = 'status healthy';
            api2Healthy = true;
        } else {
            statusEl.textContent = 'Unhealthy';
            statusEl.className = 'status unhealthy';
            api2Healthy = false;
        }

        displayStorageResult({ success: true, data });
    } catch (error) {
        document.getElementById('api2-status').className = 'status unhealthy';
        document.getElementById('api2-status').textContent = 'Unhealthy';
        api2Healthy = false;
        displayStorageResult({ success: false, error: error.message });
    }
}

async function uploadContent() {
    if (!api2Healthy) {
        alert('Check API 2 health first');
        return;
    }

    const filename = document.getElementById('content-filename').value;
    const content = document.getElementById('content-text').value;

    if (!filename || !content) {
        alert('Enter filename and content');
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api2Url}/api/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content })
        });
        const data = await response.json();
        displayStorageResult(data);
        document.getElementById('content-filename').value = '';
        document.getElementById('content-text').value = '';
    } catch (error) {
        displayStorageResult({ success: false, error: error.message });
    }
}

async function uploadFile() {
    if (!api2Healthy) {
        alert('Check API 2 health first');
        return;
    }

    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('Select a file');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const url = `${config.api2Url}/api/upload`;
        const response = await fetch(url, { method: 'POST', body: formData });

        let data;
        const text = await response.text();
        try {
            data = text ? JSON.parse(text) : null;
        } catch (parseError) {
            console.error('Parse error:', parseError, 'Response text:', text);
            data = { success: false, error: `Invalid response: ${text.substring(0, 200)}` };
        }

        logRequest('POST', url, { file: file.name, size: file.size }, response.status, data, null);
        displayStorageResult(data);
        fileInput.value = '';
    } catch (error) {
        logRequest('POST', `${config.api2Url}/api/upload`, { file: file.name }, null, null, error.message);
        displayStorageResult({ success: false, error: error.message });
    }
}

async function listFiles() {
    if (!api2Healthy) {
        alert('Check API 2 health first');
        return;
    }

    try {
        const response = await fetchWithLogging(`${config.api2Url}/api/files`);
        const data = await response.json();

        if (data.success && data.files) {
            const filesHtml = data.files.map(file => `
                <div class="item file-item">
                    <div class="file-info">
                        <strong>${file.name}</strong><br>
                        Size: ${file.size} bytes<br>
                        Type: ${file.contentType || 'N/A'}<br>
                        Modified: ${new Date(file.lastModified).toLocaleString()}
                    </div>
                    <div class="file-actions">
                        <button onclick="downloadFile('${file.name}')" class="download-btn">Download</button>
                        <button onclick="deleteFile('${file.name}')" class="delete-btn">Delete</button>
                    </div>
                </div>
            `).join('');

            document.getElementById('storage-results').innerHTML = filesHtml || '<div>No files found</div>';
        } else {
            displayStorageResult(data);
        }
    } catch (error) {
        displayStorageResult({ success: false, error: error.message });
    }
}

async function downloadFile(blobName) {
    if (!api2Healthy) {
        alert('Check API 2 health first');
        return;
    }

    try {
        const url = `${config.api2Url}/api/files/${encodeURIComponent(blobName)}`;
        logRequest('GET', url, null, null, { message: 'Download initiated' }, null);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const downloadName = `${timestamp}_${blobName}`;

        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            logRequest('GET', url, null, 200, { message: 'Download complete', savedAs: downloadName }, null);
        }, 100);
    } catch (error) {
        logRequest('GET', `${config.api2Url}/api/files/${blobName}`, null, null, null, error.message);
        displayStorageResult({ success: false, error: error.message });
    }
}

async function deleteFile(blobName) {
    if (!api2Healthy) {
        alert('Check API 2 health first');
        return;
    }

    if (!confirm(`Delete "${blobName}"?`)) {
        return;
    }

    try {
        const url = `${config.api2Url}/api/files/${encodeURIComponent(blobName)}`;
        const response = await fetchWithLogging(url, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            displayStorageResult({ success: true, message: `Deleted ${blobName}` });
            setTimeout(() => listFiles(), 500);
        } else {
            displayStorageResult(data);
        }
    } catch (error) {
        displayStorageResult({ success: false, error: error.message });
    }
}

function displayStorageResult(result) {
    const resultsDiv = document.getElementById('storage-results');

    if (result.success) {
        resultsDiv.innerHTML = `<div class="success">Success!</div><pre>${JSON.stringify(result, null, 2)}</pre>`;
    } else {
        resultsDiv.innerHTML = `<div class="error">Error: ${result.error}</div>`;
    }
}

loadConfig();
