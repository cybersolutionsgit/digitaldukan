import { restoreBackup } from '../backups.js';
const [archive, destination] = process.argv.slice(2);
if (!archive || !destination) {
  console.error('Usage: npm run restore -- /path/to/backup.tar.gz /empty/new/data-directory');
  process.exit(1);
}
try {
  await restoreBackup(archive, destination);
  console.log('Backup restored and checked. Old sessions and reset links are revoked. Set DATA_DIR to the restored directory before starting.');
} catch (error) { console.error(error.message); process.exit(1); }
