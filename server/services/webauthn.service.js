/**
 * WebAuthn helpers for browser passkey / fingerprint / Face ID unlock at check-in.
 * Challenges are stored in-memory (fine for single-instance; use Redis for multi-instance).
 */
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const challenges = new Map(); // key -> { value: string, expires: number }

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function getWebAuthnConfig() {
  const rpName = process.env.WEBAUTHN_RP_NAME || 'HRMS';
  const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  const origins = (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { rpName, rpID, origins };
}

function setChallenge(key, value) {
  challenges.set(key, { value, expires: Date.now() + CHALLENGE_TTL_MS });
}

function takeChallenge(key) {
  const row = challenges.get(key);
  if (!row) return null;
  challenges.delete(key);
  if (row.expires < Date.now()) return null;
  return row.value;
}

function pruneChallenges() {
  const now = Date.now();
  for (const [k, v] of challenges.entries()) {
    if (v.expires < now) challenges.delete(k);
  }
}

setInterval(pruneChallenges, 60 * 1000).unref?.();

async function buildRegistrationOptions(user) {
  const { rpName, rpID } = getWebAuthnConfig();
  const userID = Buffer.from(String(user._id), 'utf8');
  const exclude = (user.webAuthnCredentials || []).map((c) => ({
    id: c.credentialID,
    transports: c.transports || [],
  }));
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name || user.email,
    userID,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials: exclude,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });
  setChallenge(`reg:${user._id}`, options.challenge);
  return options;
}

async function verifyAndSaveRegistration(user, body) {
  const { rpID, origins } = getWebAuthnConfig();
  const expectedChallenge = takeChallenge(`reg:${user._id}`);
  if (!expectedChallenge) {
    throw new Error('Registration session expired. Request new options.');
  }
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo?.credential) {
    throw new Error('WebAuthn registration verification failed.');
  }
  const cred = verification.registrationInfo.credential;
  const exists = (user.webAuthnCredentials || []).some((c) => c.credentialID === cred.id);
  if (!exists) {
    user.webAuthnCredentials = user.webAuthnCredentials || [];
    const pub = cred.publicKey;
    user.webAuthnCredentials.push({
      credentialID: cred.id,
      credentialPublicKey: Buffer.isBuffer(pub) ? pub : Buffer.from(pub),
      counter: cred.counter,
      transports: cred.transports || [],
    });
  }
  await user.save();
  return { verified: true };
}

async function buildAuthenticationOptions(user) {
  const { rpID } = getWebAuthnConfig();
  const creds = user.webAuthnCredentials || [];
  if (!creds.length) {
    throw new Error('No passkey registered for this account. Register in Check In first.');
  }
  const allowCredentials = creds.map((c) => ({
    id: c.credentialID,
    transports: c.transports || [],
  }));
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
    timeout: 60000,
  });
  setChallenge(`auth:${user._id}`, options.challenge);
  return options;
}

async function verifyAuthenticationForAttendance(user, assertionBody) {
  const { rpID, origins } = getWebAuthnConfig();
  const expectedChallenge = takeChallenge(`auth:${user._id}`);
  if (!expectedChallenge) {
    throw new Error('Biometric session expired. Please try check-in again.');
  }
  const credId = assertionBody?.id;
  const dbCred = (user.webAuthnCredentials || []).find((c) => c.credentialID === credId);
  if (!dbCred) {
    throw new Error('Unknown passkey credential.');
  }
  const credential = {
    id: dbCred.credentialID,
    publicKey: dbCred.credentialPublicKey,
    counter: dbCred.counter,
  };
  const verification = await verifyAuthenticationResponse({
    response: assertionBody,
    expectedChallenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential,
    requireUserVerification: true,
  });
  if (!verification.verified) {
    throw new Error('WebAuthn verification failed.');
  }
  if (typeof verification.authenticationInfo?.newCounter === 'number') {
    dbCred.counter = verification.authenticationInfo.newCounter;
    await user.save();
  }
  return true;
}

module.exports = {
  getWebAuthnConfig,
  buildRegistrationOptions,
  verifyAndSaveRegistration,
  buildAuthenticationOptions,
  verifyAuthenticationForAttendance,
};
