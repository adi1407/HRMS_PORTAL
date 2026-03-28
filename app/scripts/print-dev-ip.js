/**
 * Prints your current LAN IPv4 so you can set EXPO_PUBLIC_API_URL in .env
 * when using a local HRMS server. Run after you connect to Wi‑Fi at a new place.
 */
const os = require('os');

const ifaces = os.networkInterfaces();
const candidates = [];

for (const name of Object.keys(ifaces)) {
  for (const addr of ifaces[name] || []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      candidates.push({ name, address: addr.address });
    }
  }
}

console.log('');
console.log('Your machine LAN IPv4 (pick the one on your active Wi‑Fi / Ethernet):');
console.log('');

if (candidates.length === 0) {
  console.log('  (none found — check network connection)');
} else {
  candidates.forEach(({ name, address }) => {
    console.log(`  ${address}  (${name})`);
  });
}

// Prefer typical home Wi‑Fi (192.168.x) over Hyper-V/WSL bridges (e.g. 172.19.x)
const preferred =
  candidates.find((c) => /^192\.168\./.test(c.address)) ||
  candidates.find((c) => /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address)) ||
  candidates[0];

if (preferred) {
  const port = process.env.HRMS_API_PORT || '5000';
  const base = `http://${preferred.address}:${port}`;
  console.log('');
  console.log('Suggested .env line for local API (update .env and restart Expo):');
  console.log('');
  console.log(`  EXPO_PUBLIC_API_URL=${base}`);
  console.log('');
  console.log('Phone must be on the same Wi‑Fi. For different networks, use a cloud API URL or tunnel.');
}

console.log('');
