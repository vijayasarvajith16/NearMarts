'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || process.env.GATEWAY_PORT || 4000;

app.listen(PORT, () => {
  console.log(
    `[gateway] API Gateway listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`
  );
  console.log(`[gateway] Socket.io note: Socket.io clients connect directly to realtime-service on port 4007.`);
});
