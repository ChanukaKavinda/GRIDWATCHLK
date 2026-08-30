const env = require('../config/env');


async function sendSms(phone, message) {
  if (env.SMS_PROVIDER === 'console' || env.NODE_ENV !== 'production') {
    console.log('\n─────────── SMS ───────────');
    console.log(`To  : ${phone}`);
    console.log(`Text: ${message}`);
    console.log('───────────────────────────\n');
    return { ok: true, provider: 'console' };
  }


  throw new Error('No SMS provider configured');
}

module.exports = { sendSms };