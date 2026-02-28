import axios from "axios";

const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

let cachedAccessToken = null;
let cachedExpiryTimeMs = 0;

function isTokenValid() {
  if (!cachedAccessToken) {
    return false;
  }

  return Date.now() < cachedExpiryTimeMs - TOKEN_REFRESH_BUFFER_MS;
}

export function clearOpenSkyTokenCache() {
  cachedAccessToken = null;
  cachedExpiryTimeMs = 0;
}

export async function getOpenSkyToken() {
  if (isTokenValid()) {
    return cachedAccessToken;
  }

  const clientId = process.env.OPENSKY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("OpenSky OAuth credentials are missing");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const { data } = await axios.post(OPENSKY_TOKEN_URL, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 9_000,
  });

  const accessToken = data?.access_token;
  const expiresInSeconds = Number.parseInt(String(data?.expires_in ?? ""), 10);

  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("OpenSky token response is invalid");
  }

  cachedAccessToken = accessToken;
  cachedExpiryTimeMs = Date.now() + expiresInSeconds * 1000;

  return cachedAccessToken;
}
