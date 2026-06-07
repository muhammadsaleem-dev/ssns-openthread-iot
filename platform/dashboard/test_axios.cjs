const axios = require('axios');
const unresolvedOnly = true;
const types = ['NODE_OFFLINE', 'HIGH_CO2'];
const page = 0;
const size = 10;
const params = { unresolvedOnly, page, size };
if (types && types.length > 0) {
  params.types = types.join(',');
}
console.log(axios.getUri({ url: '/api/alerts/page', params }));
