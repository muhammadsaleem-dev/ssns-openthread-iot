const axios = require('axios');
(async () => {
  try {
    const params = { unresolvedOnly: true, page: 0, size: 10, types: ['NODE_OFFLINE', 'HIGH_CO2'] };
    const { data } = await axios.get('http://localhost:8080/api/alerts/page', { params });
    console.log("Returned types:", data.content.map(a => a.type));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
})();
