#!/usr/bin/env node
'use strict';
// Uses only Node built-ins; REA owns and closes its isolated Chrome process.
// node tests/shader-finiteness.cjs --rea /path/to/rea.mjs --browser /path/to/chrome
// Optional --source-root /path/to/old/checkout verifies that the old version fails.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--rea', '--browser', '--source-root', '--suite'].includes(key) || !value) throw Error('Usage: node tests/shader-finiteness.cjs --rea /path/to/rea.mjs --browser /path/to/chrome [--source-root /path/to/checkout] [--suite rain-glass|lighting-optimization]');
  options[key] = value;
}
const rea = options['--rea'] || process.env.REA_CLI;
const browser = options['--browser'] || process.env.CHROME_EXECUTABLE;
if (!rea || !browser) throw Error('Provide --rea and --browser (or REA_CLI and CHROME_EXECUTABLE).');
const sourceRoot = path.resolve(options['--source-root'] || path.join(__dirname, '..'));
const suite = options['--suite'] || 'shaders';
if (!['shaders', 'rain-glass', 'lighting-optimization'].includes(suite)) throw Error('Unknown GPU regression suite: ' + suite);
const browserSuites = { shaders: 'shader-finiteness-browser.js', 'rain-glass': 'rain-glass-browser.js', 'lighting-optimization': 'lighting-optimization-browser.js' };
const routes = {
  '/': path.join(__dirname, 'shader-finiteness.html'),
  '/test.js': path.join(__dirname, browserSuites[suite]),
  '/shared/vendor/three.min.js': path.join(sourceRoot, 'shared/vendor/three.min.js'),
  '/shared/penthouse-traffic.js': path.join(sourceRoot, 'shared/penthouse-traffic.js'),
  '/shared/penthouse-whale.js': path.join(sourceRoot, 'shared/penthouse-whale.js'),
  '/shared/penthouse-weather.js': path.join(sourceRoot, 'shared/penthouse-weather.js')
};
if (suite === 'lighting-optimization') {
  routes['/shared/vendor/RectAreaLightUniformsLib.js'] = path.join(sourceRoot, 'shared/vendor/RectAreaLightUniformsLib.js');
  routes['/shared/penthouse-lighting-optimization.js'] = path.join(sourceRoot, 'shared/penthouse-lighting-optimization.js');
}
for (const file of Object.values(routes)) fs.accessSync(file, fs.constants.R_OK);
const server = http.createServer((request, response) => {
  const file = routes[new URL(request.url, 'http://127.0.0.1').pathname];
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'application/javascript');
  response.setHeader('Cache-Control', 'no-store'); response.end(fs.readFileSync(file));
});
async function main() {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const scenario = {
      browser: { mode: 'launch', executable_path: browser },
      start_url: { url: 'http://127.0.0.1:' + server.address().port + '/' },
      actions: [{ step_id: 'shader-regression', action: 'wait_for', locator: { kind: 'css', selector: 'body[data-probe-ready]' }, state: 'attached', timeout_ms: 30000 }],
      capture: { at_end: ['dom'], events: ['console', 'page-errors'] },
      environment: { viewport: { width: 1000, height: 700, device_scale_factor: 1 } }
    };
    const evidence = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.resolve(rea), 'capture-browser-scenario', JSON.stringify(scenario), '--format', 'json']);
      let stdout = '', stderr = '';
      const timeout = setTimeout(() => { child.kill(); reject(Error('REA shader regression timed out')); }, 60000);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('close', code => {
        clearTimeout(timeout);
        if (code) { reject(Error('REA failed (' + code + '): ' + stderr + stdout.slice(0, 1000))); return; }
        try { resolve(JSON.parse(stdout)); } catch (error) { reject(Error('Invalid REA evidence: ' + error.message)); }
      });
    });
    const result = evidence.normalized_result;
    const last = result.steps.findLast(step => step.artifacts?.dom?.state === 'captured');
    const html = last?.artifacts.dom.value.text;
    const match = html?.match(/<pre id="shader-report">([\s\S]*?)<\/pre>/);
    if (!match) throw Error('No completed GPU regression report in the REA DOM capture.');
    const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const report = JSON.parse(decode(match[1]));
    report.browser = result.browser;
    const events = result.events?.items || [];
    report.browserEvents = events;
    // Compilation and page errors must not silently pass as an empty target.
    if (events.some(event => event.level === 'error' || /page.?error/i.test(event.kind || ''))) report.pass = false;
    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) process.exitCode = 1;
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; server.close(); });
