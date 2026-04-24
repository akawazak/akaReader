const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron-main.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update getJreUrl to be async and fetch from Adoptium
const getJreUrlOld = /function getJreUrl\(\) \{[\s\S]*?\}/;
const getJreUrlNew = `async function getJreUrl() {
  return new Promise((resolve, reject) => {
    https.get(
      'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows',
      { headers: { 'User-Agent': 'akaReader/3.0' } },
      res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const r = JSON.parse(data);
            if (r[0]?.binary?.package?.link) resolve(r[0].binary.package.link);
            else reject(new Error('No JRE link found in Adoptium API'));
          } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });
}`;

content = content.replace(getJreUrlOld, getJreUrlNew);

// 2. Update ensureJre to await getJreUrl
content = content.replace(
  'await download(getJreUrl(), zipPath, pct => {',
  'const url = await getJreUrl();\n  await download(url, zipPath, pct => {'
);

// 3. Add more logging to startServer
content = content.replace(
  'console.log(\'[server] starting\');',
  'console.log(\'[server] starting on port 3001\');'
);

fs.writeFileSync(filePath, content);
console.log('Successfully updated electron-main.js');
