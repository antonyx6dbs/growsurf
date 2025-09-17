exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  const headers = {
    'Access-Control-Allow-Origin': ['https://www.lucentfinancialplanning.co.uk','https://lucentfp.webflow.io'].includes(origin) ? origin : 'https://www.lucentfinancialplanning.co.uk',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')  return { statusCode: 405, headers, body: 'Method Not Allowed' };

  // <-- Make sure we read and trim the vars
  const campaignId = (process.env.GROWSURF_CAMPAIGN_ID || '').trim();
  const apiKey     = (process.env.GROWSURF_API_KEY      || '').trim();

  // Fail LOUDLY if missing
  if (!campaignId || !apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: `Missing env vars: ${!campaignId ? 'GROWSURF_CAMPAIGN_ID ' : ''}${!apiKey ? 'GROWSURF_API_KEY' : ''}`
      })
    };
  }

  try {
    const { email, firstName, lastName, advisorUrl, advisorName, ipAddress, fingerprint } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing email' }) };

    // Call GrowSurf REST (header is case-insensitive, this form is canonical)
    const resp = await fetch(`https://api.growsurf.com/v2/campaign/${campaignId}/participant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        email, firstName, lastName, ipAddress, fingerprint,
        metadata: { advisorUrl: advisorUrl || null, advisorName: advisorName || null }
      }),
    });

    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw:text }; }

    if (!resp.ok) {
      // Bubble up exact upstream status/body to help us debug
      return { statusCode: resp.status, headers, body: JSON.stringify({ ok:false, status:resp.status, upstream:data }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, participant:data, shareUrl:data.shareUrl || null }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:String(err) }) };
  }
};
