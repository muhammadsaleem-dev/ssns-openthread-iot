const axios = require('axios');
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Received URL:', req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
  server.close();
});

server.listen(8085, async () => {
  try {
    const client = axios.create({ baseURL: 'http://localhost:8085' });
    const params = { unresolvedOnly: true, page: 0, size: 10 };
    const types = ['NODE_OFFLINE'];
    if (types && types.length > 0) {
      params.types = types.join(',');
    }
    await client.get('/api/alerts/page', { params });
  } catch (err) {
    console.error(err);
  }
});
