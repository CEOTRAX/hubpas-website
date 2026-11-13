// Upload a verified APK in restartable chunks when the standard Storage stream loses its offset.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Storage } = require('@google-cloud/storage');
const { localCliCredentials } = require('./local-cli-credentials.cjs');

const [source, version, expectedSha, architecture = 'universal'] = process.argv.slice(2);
if (!source || !/^\d+\.\d+\.\d+$/.test(version || '') || !/^[a-f0-9]{64}$/.test(expectedSha || '') || !['universal','arm64','armv7'].includes(architecture)) {
  console.error('Usage: node server/upload-apk-resilient.cjs <release.apk> <version> <sha256> [architecture]');
  process.exit(2);
}
const bucketName = 'dmap-50136.firebasestorage.app';
const objectPath = `downloads/Hubpas-${version}${architecture === 'universal' ? '' : `-${architecture}`}-${expectedSha.slice(0,8)}.apk`;
const storage = new Storage({ projectId: 'dmap-50136', credentials: localCliCredentials() });
const object = storage.bucket(bucketName).file(objectPath);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const chunkSize = 4 * 1024 * 1024;

async function getToken() {
  const response = await storage.authClient.getAccessToken();
  const token = typeof response === 'string' ? response : response?.token;
  if (!token) throw new Error('Firebase account token unavailable');
  return token;
}
async function digest(file) {
  const sha = crypto.createHash('sha256'), md5 = crypto.createHash('md5');
  for await (const part of fs.createReadStream(file)) { sha.update(part); md5.update(part); }
  return { sha: sha.digest('hex'), md5: md5.digest('base64') };
}
async function startSession(size, token, downloadToken) {
  const uri = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o`);
  uri.searchParams.set('uploadType', 'resumable');
  uri.searchParams.set('name', objectPath);
  uri.searchParams.set('ifGenerationMatch', '0');
  const response = await fetch(uri, { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': 'application/vnd.android.package-archive',
    'X-Upload-Content-Length': String(size),
  }, body: JSON.stringify({ name: objectPath, contentType: 'application/vnd.android.package-archive',
    contentDisposition: `attachment; filename="Hubpas-${version}${architecture === 'universal' ? '' : `-${architecture}`}.apk"`,
    cacheControl: 'public, max-age=31536000, immutable',
    metadata: { firebaseStorageDownloadTokens: downloadToken, sha256: expectedSha } }),
    signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Storage upload start failed: HTTP ${response.status}`);
  const location = response.headers.get('location');
  if (!location || new URL(location).hostname !== 'storage.googleapis.com') throw new Error('Unexpected upload session address');
  return location;
}
function nextOffset(response) {
  const range = response.headers.get('range');
  const match = range && /^bytes=0-(\d+)$/.exec(range);
  return match ? Number(match[1]) + 1 : 0;
}
async function status(session, size) {
  const response = await fetch(session, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': `bytes */${size}` }, signal: AbortSignal.timeout(30000) });
  if (response.status === 308) return nextOffset(response);
  if (response.ok) return size;
  if (response.status === 404 || response.status === 410) return -1;
  throw new Error(`Storage upload status failed: HTTP ${response.status}`);
}
async function main() {
  const file = path.resolve(source);
  const stat = await fs.promises.stat(file);
  if (!stat.isFile() || !file.toLowerCase().endsWith('.apk')) throw new Error('Choose a release APK');
  const hashes = await digest(file);
  if (hashes.sha !== expectedSha) throw new Error('APK SHA-256 does not match');
  const [exists] = await object.exists();
  let metadata;
  if (exists) [metadata] = await object.getMetadata();
  else {
    const token = await getToken();
    const downloadToken = crypto.randomUUID();
    let session = await startSession(stat.size, token, downloadToken);
    let offset = 0, failures = 0, lastReported = 0;
    const handle = await fs.promises.open(file, 'r');
    try {
      while (offset < stat.size) {
        const length = Math.min(chunkSize, stat.size - offset);
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await handle.read(buffer, 0, length, offset);
        if (bytesRead !== length) throw new Error('Could not read APK chunk');
        try {
          const response = await fetch(session, { method: 'PUT', headers: {
            'Content-Length': String(length), 'Content-Range': `bytes ${offset}-${offset + length - 1}/${stat.size}`,
            'Content-Type': 'application/vnd.android.package-archive',
          }, body: buffer, signal: AbortSignal.timeout(90000) });
          if (response.status === 308) offset = nextOffset(response);
          else if (response.ok) offset = stat.size;
          else throw new Error(`Storage chunk failed: HTTP ${response.status}`);
          failures = 0;
          if (offset - lastReported >= 32 * 1024 * 1024 || offset === stat.size) { console.log(`Uploaded ${Math.round(offset / 1048576)} of ${Math.round(stat.size / 1048576)} MB`); lastReported = offset; }
        } catch (error) {
          if (++failures > 15) throw error;
          await sleep(Math.min(1000 * failures, 5000));
          const saved = await status(session, stat.size).catch(() => -1);
          if (saved < 0) { session = await startSession(stat.size, token, downloadToken); offset = 0; }
          else offset = saved;
          console.warn(`Resuming at ${Math.round(offset / 1048576)} MB after interruption`);
        }
      }
    } finally { await handle.close(); }
    [metadata] = await object.getMetadata();
  }
  if (metadata.size !== String(stat.size) || metadata.md5Hash !== hashes.md5 || metadata.metadata?.sha256 !== hashes.sha) throw new Error('Uploaded APK does not match local release');
  const downloadToken = metadata.metadata?.firebaseStorageDownloadTokens;
  if (!downloadToken) throw new Error('Download token missing');
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
  console.log(JSON.stringify({ objectPath, architecture, size: stat.size, sha256: hashes.sha, url }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
