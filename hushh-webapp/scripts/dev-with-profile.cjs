#!/usr/bin/env node

const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const CANONICAL_PROFILES = ['local-uatdb', 'uat-remote', 'prod-remote'];

const repoRoot = path.resolve(__dirname, '../..');
const webRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const passthrough = [];
  let profile = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      passthrough.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--profile=')) {
      profile = arg.split('=', 2)[1] || null;
      continue;
    }
    if (arg === '--profile') {
      profile = argv[i + 1] || null;
      i += 1;
      continue;
    }
    passthrough.push(arg);
  }

  return { profile, passthrough };
}

function normalizeProfile(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized) return null;
  if (CANONICAL_PROFILES.includes(normalized)) return normalized;
  return null;
}

function activateProfile(profile) {
  const scriptPath = path.join(repoRoot, 'scripts/env/use_profile.sh');
  const result = spawnSync('bash', [scriptPath, profile], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  const { profile: argProfile, passthrough } = parseArgs(process.argv.slice(2));
  const envProfile = normalizeProfile(process.env.APP_RUNTIME_PROFILE);
  const requested = normalizeProfile(argProfile) || envProfile;
  const defaultProfile = 'local-uatdb';

  const profile = requested || defaultProfile;
  if (!requested) {
    console.log(
      `No runtime profile was specified. Defaulting to ${profile}. ` +
        'Use make dev PROFILE=<profile> or npm run dev -- --profile=<profile> for an explicit target.'
    );
  }

  if (!profile) {
    console.error('Invalid runtime profile. Use one of: local-uatdb, uat-remote, prod-remote');
    process.exit(1);
  }

  activateProfile(profile);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', 'dev:next'];
  if (passthrough.length > 0) {
    args.push('--', ...passthrough);
  }

  const child = spawn(npmCmd, args, {
    cwd: webRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });

  child.on('error', (error) => {
    console.error(`Failed to launch Next.js dev server: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
