// Netlify Function: growsurf-add-participant.js
// Server-side creates/upsserts a GrowSurf participant and returns shareUrl.

const ALLOWED_ORIGINS = [
  'https://www.lucentfinancialplanning.co.uk',
  'https://lucentfp.webflow.io', // keep if you test on Webflow preview
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

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const campaignId = (process.env.GROWSURF_CAMPAIGN_ID || '').trim();
  const apiKey     = (process.env.GROWSURF_API_KEY      || '').trim();

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

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Invalid JSON body' }) }; }

  const { email, firstName, lastName, advisorUrl, advisorName, ipAddress, fingerprint } = body;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing email' }) };

  try {
    // >> Key change: Use Authorization: Bearer <API_KEY>
    const resp = await fetch(`https://api.growsurf.com/v2/campaign/${campaignId}/participant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email, firstName, lastName, ipAddress, fingerprint,
        metadata: { advisorUrl: advisorUrl || null, advisorName: advisorName || null },
      }),
    });

    const txt = await resp.text();
    let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ ok:false, status: resp.status, upstream: data }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, participant: data, shareUrl: data.shareUrl || null }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error: String(err) }) };
  }
};
