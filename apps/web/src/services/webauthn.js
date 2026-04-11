// Utility helpers for WebAuthn (Passkey) flows

function base64urlToUint8Array(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64url(uint8Array) {
  let string = '';
  for (let i = 0; i < uint8Array.byteLength; i += 1) {
    string += String.fromCharCode(uint8Array[i]);
  }
  const base64String = btoa(string)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return base64String;
}

// Convert server-provided creation options to proper PublicKeyCredentialCreationOptions
function transformRegistrationOptions(options) {
  const publicKey = { ...options };
  if (publicKey.challenge) publicKey.challenge = base64urlToUint8Array(publicKey.challenge);
  if (publicKey.user && publicKey.user.id) publicKey.user = { ...publicKey.user, id: base64urlToUint8Array(publicKey.user.id) };
  if (Array.isArray(publicKey.excludeCredentials)) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((cred) => ({
      ...cred,
      id: base64urlToUint8Array(cred.id)
    }));
  }
  // Enforce resident/discoverable credentials for usernameless login
  publicKey.authenticatorSelection = {
    requireResidentKey: true,
    residentKey: 'required',
    userVerification: 'required',
    ...(publicKey.authenticatorSelection || {}),
  };
  // Back-compat top-level fields (some authenticators check these)
  if (!publicKey.residentKey) publicKey.residentKey = 'required';
  if (!publicKey.userVerification) publicKey.userVerification = 'required';
  return { publicKey };
}

// Convert server-provided request options to proper PublicKeyCredentialRequestOptions
function transformAssertionOptions(options) {
  const publicKey = { ...options };
  if (publicKey.challenge) publicKey.challenge = base64urlToUint8Array(publicKey.challenge);
  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((cred) => ({
      ...cred,
      id: base64urlToUint8Array(cred.id)
    }));
  }
  // Require user verification to support usernameless login reliably
  if (!publicKey.userVerification) publicKey.userVerification = 'required';
  return { publicKey };
}

// Convert a PublicKeyCredential response to JSON-friendly format with base64url fields
function publicKeyCredentialToJSON(cred) {
  if (!cred) return null;

  const obj = {
    id: cred.id,
    type: cred.type,
    rawId: uint8ArrayToBase64url(new Uint8Array(cred.rawId)),
    clientExtensionResults: cred.getClientExtensionResults?.() || {},
  };

  if (cred.response) {
    obj.response = {};
    if (cred.response.attestationObject) {
      obj.response.attestationObject = uint8ArrayToBase64url(new Uint8Array(cred.response.attestationObject));
    }
    if (cred.response.clientDataJSON) {
      obj.response.clientDataJSON = uint8ArrayToBase64url(new Uint8Array(cred.response.clientDataJSON));
    }
    if (cred.response.authenticatorData) {
      obj.response.authenticatorData = uint8ArrayToBase64url(new Uint8Array(cred.response.authenticatorData));
    }
    if (cred.response.signature) {
      obj.response.signature = uint8ArrayToBase64url(new Uint8Array(cred.response.signature));
    }
    if (cred.response.userHandle) {
      obj.response.userHandle = uint8ArrayToBase64url(new Uint8Array(cred.response.userHandle));
    }
  }

  return obj;
}

export {
  base64urlToUint8Array,
  uint8ArrayToBase64url,
  transformRegistrationOptions,
  transformAssertionOptions,
  publicKeyCredentialToJSON,
};


