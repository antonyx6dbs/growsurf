// CommonJS Netlify Function (Node 18+ has global fetch)
const ALLOWED_ORIGINS = [
  'https://www.lucentfinancialplanning.co.uk',
  'https://lucentfp.webflow.io',            // include your Webflow preview domain if you test there
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { email, firstName, lastName, advisorUrl, advisorName, ipAddress, fingerprint } =
      JSON.parse(event.body || '{}');

    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing email' }) };
    }

    const campaignId = process.env.GROWSURF_CAMPAIGN_ID; // e.g. "trtaq2"
    const apiKey     = process.env.GROWSURF_API_KEY;     // your secret key

    const resp = await fetch(`https://api.growsurf.com/v2/campaign/${campaignId}/participant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
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
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ ok: false, error: data }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, participant: data, shareUrl: data.shareUrl || null }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
