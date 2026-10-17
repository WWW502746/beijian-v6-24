const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const source = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(source, '_site'));
assert(!fs.existsSync(output), 'Choose a new output folder.');
const template = JSON.parse(fs.readFileSync(path.join(source, 'site-template.json')));
const stream = JSON.parse(fs.readFileSync(path.join(source, '_media/stream-manifest.json')));
const base = template.basePath;
const relativeFile = url => {
  assert(url.startsWith(base));
  const file = decodeURIComponent(new URL(url, 'https://beijian.invalid').pathname.slice(base.length));
  assert(file && !file.split('/').includes('..'));
  return file;
};
const files = new Set([...template.desktop.files, ...template.mobile.files].map(item => relativeFile(item.url)));
const reconstructed = new Set(stream.videos.map(item => item.original));
fs.mkdirSync(output, {recursive: true});
for (const file of [...files, ...template.extraFiles]) {
  if (reconstructed.has(file)) continue;
  assert(!file.split('/').includes('..'));
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(path.join(source, file), destination);
}
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
for (const video of stream.videos) {
  assert(files.has(video.original));
  const destination = path.join(output, video.original);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const fd = fs.openSync(destination, 'w'), hash = crypto.createHash('sha256');
  let size = 0;
  try {
    for (const part of video.orderedParts) {
      assert(/^_media\/[\w.-]+\.bin$/.test(part.path));
      const data = fs.readFileSync(path.join(source, part.path));
      assert.equal(data.length, part.size); assert.equal(digest(data), part.sha256);
      fs.writeFileSync(fd, data); hash.update(data); size += data.length;
    }
  } finally {fs.closeSync(fd);}
  assert.equal(size, video.size); assert.equal(hash.digest('hex'), video.originalSha256);
}
const payload = mode => {
  const records = template[mode].files.map(item => {
    const data = fs.readFileSync(path.join(output, relativeFile(item.url)));
    return {...item, bytes: data.length, sha256: digest(data)};
  });
  const groups = {};
  for (const item of records) {
    groups[item.group] ||= {files: 0, bytes: 0};
    groups[item.group].files++; groups[item.group].bytes += item.bytes;
  }
  return {files: records, bytes: records.reduce((total, item) => total + item.bytes, 0), groups};
};
const desktop = payload('desktop'), mobile = payload('mobile');
const cacheVersion = digest(JSON.stringify({desktop: desktop.files, mobile: mobile.files}));
const manifest = {version: 1, revision: template.revision, cacheVersion, builtAt: new Date().toISOString(), desktop, mobile};
fs.writeFileSync(path.join(output, 'preload-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const bytes = [...files, ...template.extraFiles, 'preload-manifest.json'].reduce((total, file) => total + fs.statSync(path.join(output, file)).size, 0);
assert(bytes < 1000000000, 'GitHub Pages site must remain below 1 GB.');
console.log(JSON.stringify({output, bytes, desktop: {files: desktop.files.length, bytes: desktop.bytes}, cacheVersion}, null, 2));
