// Writes a semver version to package.json, package-lock.json and public/manifest.json.
// Usage: node scripts/set-version.mjs 1.2.3[-prerelease][+build]
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

const full = process.argv[2]?.replace(/^v/, '');
const match = full && SEMVER_RE.exec(full);
if(!match) {
  console.error(`Invalid version '${process.argv[2] ?? ''}', expected X.Y.Z[-prerelease][+build]`);
  process.exit(1);
}
const core = `${match[1]}.${match[2]}.${match[3]}`;

const root = resolve(import.meta.dirname, '..');

const update = (file, fn) => {
  const path = resolve(root, file);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  fn(json);
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
};

update('package.json', (pkg) => {
  pkg.version = full;
});

update('package-lock.json', (lock) => {
  lock.version = full;
  if(lock.packages?.['']) lock.packages[''].version = full;
});

// The manifest is hand-formatted, so it's edited as text to keep the layout.
// Chrome only accepts numeric "version", so the full semver goes to "version_name".
const manifestPath = resolve(root, 'public/manifest.json');
let manifest = readFileSync(manifestPath, 'utf8');
const versionRe = /^(\s*)"version": "[^"]*",\n/m;
if(!versionRe.test(manifest)) {
  console.error('Could not find "version" in public/manifest.json');
  process.exit(1);
}
manifest = manifest
  .replace(/^\s*"version_name": "[^"]*",\n/m, '')
  .replace(versionRe, (_, indent) =>
    `${indent}"version": "${core}",\n` +
    (full === core ? '' : `${indent}"version_name": "${full}",\n`));
JSON.parse(manifest);
writeFileSync(manifestPath, manifest);

console.log(`Version set to ${full} (manifest version ${core})`);
