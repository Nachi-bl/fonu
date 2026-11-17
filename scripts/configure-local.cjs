const fs = require('node:fs');
const crypto = require('node:crypto');
const env = fs.readFileSync('.env', 'utf8');
let extra = '';
for (const key of ['JWT_SECRET', 'SEED_ADMIN_PASSWORD', 'SEED_CUSTOMER_PASSWORD']) {
  if (!new RegExp('^' + key + '=', 'm').test(env))
    extra += '\n' + key + '=' + crypto.randomBytes(32).toString('hex');
}
if (extra) fs.appendFileSync('.env', extra + '\n');
console.log('Local configuration ready. Secret values were not printed.');
