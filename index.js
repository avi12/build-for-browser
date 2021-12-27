#!/usr/bin/env node
'use strict';

const fs = require('fs');
const AdmZip = require('adm-zip');
const yargs = require('yargs');

const { argv } = yargs(process.argv.slice(2));

const dirZip = 'dist_packed';
if (!fs.existsSync(dirZip)) {
  console.log(`No "${dirZip}" directory`);
  process.exit();
}

if (!argv.browser) {
  console.log("Specify either --browser=firefox or --browser=opera");
  process.exit();
}

function getManifest(zip, entry) {
  return JSON.parse(zip.getEntry(entry).getData());
}

function getModifiedManifest(manifest) {
  manifest.manifest_version = 2;
  if (manifest.browser_action) {
    manifest.browser_action = { ...manifest.action };
  }

  if (manifest.background) {
    manifest.background = {
      scripts: [manifest.background.service_worker]
    };
  }

  if (manifest.host_permissions) {
    const host_permissions = [...manifest.host_permissions];
    if (!manifest.permissions) {
      manifest.permissions = host_permissions;
    } else {
      manifest.permissions.push(...host_permissions);
    }
  }

  if (manifest.content_security_policy) {
    manifest.content_security_policy = manifest.content_security_policy.extension_pages;
  }

  delete manifest.action;
  delete manifest.host_permissions;
  return manifest;
}

function getZipName(zipName) {
  const zipNameAdapted = zipName.replace(".zip", `__adapted_for_${argv.browser}.zip`)
  if (fs.existsSync(zipNameAdapted)) {
    return zipNameAdapted;
  }

  return zipName;
}

function rebuildZipForBrowser(zipName, version) {
  let zip;
  try {
    zip = new AdmZip(getZipName(zipName));
  } catch {
    console.error(`${zipName} is in use!`);
    throw new Error();
  }
  const manifest = getModifiedManifest(getManifest(zip, 'manifest.json'));

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf-8'));
  zip.writeZip(
    argv.i.replace('{version}', `${version}__adapted_for_${argv.browser}`)
  );
}

function rebuildZipSourceForBrowser(zipName, version) {
  if (fs.existsSync(zipName)) {
    return;
  }

  try {
    zip = new AdmZip(getZipName(zipName));
  } catch {
    console.error(`${zipName} is in use!`);
    throw new Error();
  }
  const manifest = getModifiedManifest(getManifest(zip, 'dist/manifest.json'));

  zip.addFile(
    'manifest.json',
    Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8')
  );
  zip.writeZip(
    argv.i.replace(
      '{version}',
      `${version}__adapted_for_${argv.browser}-source`
    )
  );
}

function init() {
  const { version } = JSON.parse(
    fs.readFileSync('package.json', { encoding: 'utf-8' }).toString()
  );
  const name = argv.i;

  rebuildZipForBrowser(name.replace('{version}', version), version);
  rebuildZipSourceForBrowser(
    name.replace('{version}', version + '-source'),
    version
  );
}

init();
