const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure electron binary is properly extracted and path.txt exists
function ensureElectronInstalled() {
  try {
    return require('electron');
  } catch (err) {
    console.log('[Dev] Checking / extracting Electron binary...');
    const electronDir = path.join(__dirname, '../node_modules/electron');
    const distDir = path.join(electronDir, 'dist');
    const pathTxt = path.join(electronDir, 'path.txt');

    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Try finding cached zip file in LocalAppData or Cache
    const cacheDirs = [
      path.join(process.env.LOCALAPPDATA || '', 'electron/Cache'),
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache/electron')
    ];

    let foundZip = null;
    for (const cDir of cacheDirs) {
      if (fs.existsSync(cDir)) {
        const findZips = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              findZips(full);
            } else if (ent.name.endsWith('.zip') && ent.name.includes('electron')) {
              foundZip = full;
              return;
            }
          }
        };
        findZips(cDir);
        if (foundZip) break;
      }
    }

    if (foundZip) {
      console.log(`[Dev] Extracting cached Electron from: ${foundZip}`);
      try {
        execSync(`tar -xf "${foundZip}" -C "${distDir}"`, { stdio: 'inherit' });
        fs.writeFileSync(pathTxt, 'electron.exe');
        return require('electron');
      } catch (tarErr) {
        console.error('[Dev] Tar extraction failed:', tarErr);
      }
    }

    // Fallback: run install.js
    console.log('[Dev] Running node_modules/electron/install.js...');
    execSync(`node "${path.join(electronDir, 'install.js')}"`, { stdio: 'inherit' });
    return require('electron');
  }
}

const electronPath = ensureElectronInstalled();

// Start Vite without shell wrapper to avoid [DEP0190] warning in Node 26
console.log('[Dev] Starting Vite with Hot Module Replacement (HMR)...');
const viteJs = path.join(__dirname, '../node_modules/vite/bin/vite.js');
const vite = fs.existsSync(viteJs)
  ? spawn(process.execPath, [viteJs], { stdio: 'inherit' })
  : spawn(path.join(__dirname, '../node_modules/.bin/vite.cmd'), [], { stdio: 'inherit', shell: true });

let isLaunched = false;

function checkViteReady() {
  if (isLaunched) return;

  const req = http.get('http://localhost:1420', () => {
    if (!isLaunched) {
      isLaunched = true;
      console.log('\n[Dev] Vite server ready! Launching CodeStash Desktop with Live Reload...\n');

      // Launch Electron binary directly with shell: false
      const electron = spawn(electronPath, ['.', '--dev'], { stdio: 'inherit' });

      electron.on('close', () => {
        console.log('[Dev] Window closed. Stopping Vite...');
        try {
          process.kill(vite.pid);
        } catch {}
        process.exit();
      });
    }
  });

  req.on('error', () => {
    setTimeout(checkViteReady, 100);
  });
}

// Start polling
setTimeout(checkViteReady, 150);
