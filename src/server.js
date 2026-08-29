require('dotenv').config();

const env = require('./config/env');
const app = require('./app');
const { connectDB } = require('./config/db');

(async () => {
  try {
    await connectDB(env.MONGO_URI);
    app.listen(env.PORT, () => {
      console.log(`✓ API running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err.message);
    process.exit(1);
  }
})();