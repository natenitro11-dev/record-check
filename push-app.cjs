const https = require('https');
const fs = require('fs');
const path = require('path');

const token = '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';
const owner = 'natenitro11-dev';
const repo = 'record-check';
const filePath = 'src/App.jsx';
const content = fs.readFileSync(path.join(__dirname, 'app-content.b64'), 'utf8').trim();

console.log('Content length:', content.length);

const getOpts = {
  hostname: 'api.github.com',
  path: '/repos/' + owner + '/' + repo + '/contents/' + filePath,
  headers: {
    'Authorization': 'token ' + token,
    'User-Agent': 'record-check-deploy'
  }
};

https.get(getOpts, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const sha = parsed.sha;
    console.log('Got SHA:', sha);
    const body = JSON.stringify({ message: 'Deploy full app', content: content, sha: sha });
    const putOpts = {
      hostname: 'api.github.com',
      path: '/repos/' + owner + '/' + repo + '/contents/' + filePath,
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + token,
        'User-Agent': 'record-check-deploy',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(putOpts, r => {
      let d2 = '';
      r.on('data', x => d2 += x);
      r.on('end', () => {
        try {
          const resp = JSON.parse(d2);
          if (resp.content) console.log('PUSHED SUCCESSFULLY:', resp.content.name);
          else console.log('Error:', d2.slice(0, 300));
        } catch(e) { console.log('Parse error:', d2.slice(0,300)); }
      });
    });
    req.on('error', e => console.log('Request error:', e.message));
    req.write(body);
    req.end();
  });
});
