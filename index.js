#!/usr/bin/env node
"use strict";

const fs = require("fs");
const AdmZip = require("adm-zip");
const yargs = require("yargs");

const { argv } = yargs(process.argv.slice(2));

const dirZip = "dist_packed";
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
  manifest.browser_action = { ...manifest.action };
  manifest.background = {
    scripts: [manifest.background.service_worker]
  };
  delete manifest.action;
  return manifest;
}

function rebuildZipForBrowser(zipName, version) {
  const zip = new AdmZip(zipName);
  const manifest = getModifiedManifest(getManifest(zip, "manifest.json"));

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest), "utf-8"));
  zip.writeZip(argv.i.replace("{version}", `${version}__adapted_for_${argv.browser}`));
}

function rebuildZipSourceForBrowser(zipName, version) {
  const zip = new AdmZip(zipName);
  const manifest = getModifiedManifest(getManifest(zip, "dist/manifest.json"));

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
  zip.writeZip(argv.i.replace("{version}", `${version}__adapted_for_${argv.browser}-source`));
}

function init() {
  const { version } = JSON.parse(
    fs.readFileSync("package.json", { encoding: "utf-8" }).toString()
  );
  const name = argv.i;

  rebuildZipForBrowser(name.replace("{version}", version), version);
  rebuildZipSourceForBrowser(name.replace("{version}", version + "-source"), version);
}

init();
