// Netlify Function: growsurf-add-participant.js
// Creates/upsserts a GrowSurf participant and returns participant + shareUrl
// CORS is limited to your live site + Webflow preview domain.

const ALLOWED_ORIGINS = [
  'https://www.lucentfinancialplanning.co.uk',
  'https://lucentfp.webflow.io',
];

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}

exports.handler = async (event) => {
  const headers = cors(event.headers.origin || '');

  // Preflight / bad method
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: 'Method Not Allowed' };

  // --- Read + validate env vars (trim to avoid stray whitespace) ---
  const campaignId = (process.env.GROWSURF_CAMPAIGN_ID || '').trim();
  const apiKey     = (process.env.GROWSURF_API_KEY      || '').trim();

  // If missing, fail loudly and show lengths so we know what Netlify injected
  if (!campaignId || !apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: 'Missing required env vars',
        seen: { campaignIdLen: campaignId.length, apiKeyLen: apiKey.length }
      })
    };
  }

  // --- Parse request body ---
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Invalid JSON body' }) };
  }

  const {
    email,
    firstName,
    lastName,
    advisorUrl,   // stored as metadata
    advisorName,  // stored as metadata
    ipAddress,
    fingerprint
  } = body;

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing email' }) };
  }

  try {
    // --- Call GrowSurf REST API ---
    const resp = await fetch(`https://api.growsurf.com/v2/campaign/${campaignId}/participant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey, // header name per GrowSurf docs
      },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        ipAddress,
        fingerprint,
        metadata: {
          advisorUrl: advisorUrl || null,
          advisorName: advisorName || null,
        }
      }),
    });

    // Bubble up exact upstream response if not OK (helps debug 403s)
    const txt = await resp.text();
    let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ ok:false, status: resp.status, upstream: data })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        participant: data,
        shareUrl: data.shareUrl || null
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
};
