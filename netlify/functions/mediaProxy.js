const axios = require('axios');

exports.handler = async function (event, context) {
  const { targetUrl } = event.queryStringParameters;

  if (!targetUrl) {
    return { statusCode: 400, body: "Missing targetUrl query parameter." };
  }

  const allowedDomains = ["gdeltproject.org", "archive.org", "commoncrawl.org"];
  const isDomainAllowed = allowedDomains.some(domain => targetUrl.includes(domain));

  if (!isDomainAllowed) {
    return { statusCode: 403, body: "Target domain destination is unauthorized." };
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: { 'User-Agent': 'TheRecordCheck-Bot/1.0' },
      timeout: 7000
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": response.headers['content-type'] || "application/json"
      },
      body: typeof response.data === 'object' ? JSON.stringify(response.data) : response.data
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "CORS Proxy connection routing failure.", message: error.message })
    };
  }
};
