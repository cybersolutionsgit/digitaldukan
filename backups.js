import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, statSync, lstatSync, readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync, chmodSync, statfsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function files(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) return [];
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name), info = lstatSync(path);
    if (info.isSymbolicLink()) throw new Error('Backups cannot include symbolic links.');
    return info.isDirectory() ? files(path) : [path];
  });
}
export function backupRetention(){const value=Number(process.env.BACKUP_KEEP||3);return Number.isFinite(value)?Math.min(10,Math.max(1,Math.floor(value))):3;}
export function backupDirectory(dataDir) { return resolve(process.env.BACKUP_DIR || join(dataDir, 'backups')); }
export function listBackups(dataDir) {
  const dir = backupDirectory(dataDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return readdirSync(dir).filter(name => /^dukan-\d{13}-[a-f0-9]{12}\.tar\.gz$/.test(name))
    .map(name => ({ name, bytes: statSync(join(dir, name)).size, created: new Date(Number(name.split('-')[1])).toISOString() }))
    .sort((a, b) => b.name.localeCompare(a.name));
}
export function backupFile(dataDir, name) {
  if (!listBackups(dataDir).some(item => item.name === name)) return null;
  return join(backupDirectory(dataDir), name);
}
let running = false;
export async function createBackup(db, dataDir) {
  if (running) throw new Error('A backup is already running. Please wait.');
  running = true;
  const dir = backupDirectory(dataDir);
  let stage, partial;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const usage = files(join(dataDir, 'uploads')).reduce((sum, file) => sum + statSync(file).size, 0)
      + statSync(join(dataDir, 'digitaldukan.sqlite')).size;
    const fs = statfsSync(dir);
    if (Number(fs.bavail) * Number(fs.bsize) < usage * 3 + 32 * 1024 * 1024) throw new Error('Not enough free storage for a safe backup. Download existing backups and increase storage.');
    stage = mkdtempSync(join(dir, '.staging-'));
    const databaseFile = join(stage, 'digitaldukan.sqlite');
    await backup(db, databaseFile);
    const check = new DatabaseSync(databaseFile);
    try { check.exec('PRAGMA journal_mode=DELETE'); if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Database integrity check failed.'); }
    finally { check.close(); }
    const uploads = join(stage, 'uploads');
    mkdirSync(uploads, { recursive: true, mode: 0o700 });
    if (statSync(join(dataDir, 'uploads'), { throwIfNoEntry: false })) cpSync(join(dataDir, 'uploads'), uploads, { recursive: true });
    const manifest = { version: 1, created: new Date().toISOString(), files: Object.fromEntries(files(stage).map(file => [relative(stage, file).split(sep).join('/'), digest(file)])) };
    writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    const name = `dukan-${Date.now()}-${randomBytes(6).toString('hex')}.tar.gz`;
    partial = join(dir, name + '.partial');
    await exec('tar', ['-czf', partial, '-C', stage, 'manifest.json', 'digitaldukan.sqlite', 'uploads']);
    chmodSync(partial, 0o600);
    const { renameSync } = await import('node:fs');
    renameSync(partial, join(dir, name));
    const keep = backupRetention();
    for (const old of listBackups(dataDir).slice(keep)) rmSync(join(dir, old.name));
    return listBackups(dataDir).find(item => item.name === name);
  } finally {
    if (stage) rmSync(stage, { recursive: true, force: true });
    if (partial) rmSync(partial, { force: true });
    running = false;
  }
}
export async function restoreBackup(archive, target) {
  target = resolve(target);
  mkdirSync(target, { recursive: true, mode: 0o700 });
  if (readdirSync(target).length) throw new Error('Restore requires an empty destination. Stop the service and preserve existing data first.');
  const listing = (await exec('tar', ['-tzf', resolve(archive)])).stdout.trim().split('\n');
  const types = (await exec('tar', ['-tvzf', resolve(archive)])).stdout.trim().split('\n');
  if(types.some(line=>!['-','d'].includes(line[0])))throw new Error('Backup contains unsupported file types.');
  if (listing.some(name => !/^(manifest\.json|digitaldukan\.sqlite|uploads\/?|uploads\/[a-f0-9]{24}\.(png|jpg|webp))$/.test(name))) throw new Error('Backup contains unexpected paths.');
  // Restore only trusted backups created by this application, never customer uploads.
  try {
    await exec('tar', ['-xzf', resolve(archive), '-C', target, '--no-same-owner', '--no-same-permissions']);
    const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
    if (manifest.version !== 1 || !manifest.files?.['digitaldukan.sqlite']) throw new Error('Backup manifest is invalid.');
    const actual = files(target).filter(file => relative(target, file) !== 'manifest.json');
    if (actual.length !== Object.keys(manifest.files).length) throw new Error('Backup file list does not match its manifest.');
    for (const file of actual) if (manifest.files[relative(target, file).split(sep).join('/')] !== digest(file)) throw new Error('Backup checksum does not match.');
    const database = new DatabaseSync(join(target, 'digitaldukan.sqlite'));
    try {
      if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Restored database is invalid.');
      database.exec('DELETE FROM sessions; DELETE FROM auth_tokens;');
    } finally { database.close(); }
    rmSync(join(target, 'manifest.json'));
  } catch (error) {
    for (const name of readdirSync(target)) rmSync(join(target, name), { recursive: true, force: true });
    throw error;
  }
}
