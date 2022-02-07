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
  console.log('Specify either --browser=firefox or --browser=opera');
  process.exit();
}

function getValidCspDirectives(csp) {
  const contentSecurityPolicy = csp.split(/;\s*/).reduce((csp, string) => {
    const [directive, ...values] = string.split(' ');
    csp[directive] = values.join(' ');
    return csp;
  }, {});

  delete contentSecurityPolicy['prefetch-src'];
  delete contentSecurityPolicy['script-src-elem'];
  delete contentSecurityPolicy['script-src-attr'];
  delete contentSecurityPolicy['style-src-attr'];
  delete contentSecurityPolicy['style-src-elem'];
  return Object.entries(contentSecurityPolicy)
    .map(([directive, values]) => `${directive} ${values}`)
    .join('; ');
}

function getManifest(zip, entry) {
  return JSON.parse(zip.getEntry(entry).getData());
}

function getModifiedManifest(manifestCurrent) {
  const manifest = { ...manifestCurrent };
  manifest.manifest_version = 2;
  if (manifest.action) {
    manifest.browser_action = {
      ...manifest.action,
      ...manifest.browser_action,
    };
  }

  if (manifest.background) {
    manifest.background = {
      scripts: [
        manifest.background.service_worker || manifest.background.scripts[0],
      ],
    };
  }

  if (manifest.options_ui) {
    manifest.options_ui.browser_style = true;
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
    manifest.content_security_policy = getValidCspDirectives(
      manifest.content_security_policy?.extension_pages ??
        manifest.content_security_policy
    );
  }

  delete manifest.offline_enabled;
  delete manifest.action;
  delete manifest.host_permissions;
  return manifest;
}

function getZipName(zipName) {
  const zipNameAdapted = zipName.replace(
    '.zip',
    `__adapted_for_${argv.browser}.zip`
  );
  if (fs.existsSync(zipNameAdapted)) {
    return zipNameAdapted;
  }

  return zipName;
}

function rebuildZipForBrowser(zipName, version) {
  zipName = getZipName(zipName);

  const zip = new AdmZip(zipName);
  const manifest = getModifiedManifest(getManifest(zip, 'manifest.json'));

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf-8'));

  const zipNameOutput = zipName.replace(version, `${version}__adapted_for_${argv.browser}`);
  if (fs.existsSync(zipNameOutput)) {
    console.log("Removed", zipNameOutput);
    fs.unlinkSync(zipNameOutput);
  }

  zip.writeZip(zipNameOutput);
}

function rebuildZipSourceForBrowser(zipName, version) {
  zipName = getZipName(zipName);

  if (!fs.existsSync(zipName)) {
    return;
  }

  const zip = new AdmZip(zipName);
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
  if (argv.source) {
    rebuildZipSourceForBrowser(
      name.replace('{version}', `${version}-source`),
      version
    );
  }
}

init();
