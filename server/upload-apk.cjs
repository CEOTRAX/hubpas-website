// Publish a verified release APK to the Hubpas Firebase Storage bucket.
// Run locally with the configured Firebase CLI account; no credential is saved.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Storage } = require('@google-cloud/storage');
const { localCliCredentials } = require('./local-cli-credentials.cjs');

const source = process.argv[2];
const version = process.argv[3];
const expectedSha256 = process.argv[4]?.toLowerCase();
const architecture = process.argv[5] || 'universal';
if (!source || !/^\d+\.\d+\.\d+$/.test(version || '') || !/^[a-f0-9]{64}$/.test(expectedSha256 || '') || !['universal', 'arm64'].includes(architecture)) {
  console.error('Usage: node server/upload-apk.cjs <release.apk> <version> <expected-sha256> [universal|arm64]');
  process.exit(2);
}

async function hashes(file) {
  const sha256 = crypto.createHash('sha256');
  const md5 = crypto.createHash('md5');
  for await (const chunk of fs.createReadStream(file)) {
    sha256.update(chunk);
    md5.update(chunk);
  }
  return { sha256: sha256.digest('hex'), md5: md5.digest('base64') };
}

async function main() {
  const absolute = path.resolve(source);
  const stat = await fs.promises.stat(absolute);
  if (!stat.isFile() || !absolute.toLowerCase().endsWith('.apk')) throw new Error('Choose an APK file.');
  const digest = await hashes(absolute);
  if (digest.sha256 !== expectedSha256) throw new Error('APK SHA-256 does not match the verified release.');

  const objectPath = `downloads/Hubpas-${version}${architecture === 'arm64' ? '-arm64' : ''}-${digest.sha256.slice(0, 8)}.apk`;
  const storage = new Storage({ projectId: 'dmap-50136', credentials: localCliCredentials() });
  const object = storage.bucket('dmap-50136.firebasestorage.app').file(objectPath);
  const [exists] = await object.exists();
  let metadata;
  if (exists) {
    [metadata] = await object.getMetadata();
    if (metadata.size !== String(stat.size) || metadata.md5Hash !== digest.md5 || metadata.metadata?.sha256 !== digest.sha256)
      throw new Error('A different object already exists at this release path.');
  } else {
    const token = crypto.randomUUID();
    await pipeline(fs.createReadStream(absolute), object.createWriteStream({
      resumable: true,
      chunkSize: 8 * 1024 * 1024,
      validation: 'md5',
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: 'application/vnd.android.package-archive',
        contentDisposition: 'attachment; filename="Hubpas.apk"',
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: token, sha256: digest.sha256 },
      },
    }));
    [metadata] = await object.getMetadata();
    if (metadata.size !== String(stat.size) || metadata.md5Hash !== digest.md5)
      throw new Error('Uploaded object failed size or MD5 verification.');
  }
  const token = metadata.metadata?.firebaseStorageDownloadTokens;
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) throw new Error('Firebase download token is missing.');
  const url = `https://firebasestorage.googleapis.com/v0/b/dmap-50136.firebasestorage.app/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
  console.log(JSON.stringify({ objectPath, architecture, size: stat.size, sha256: digest.sha256, url }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
