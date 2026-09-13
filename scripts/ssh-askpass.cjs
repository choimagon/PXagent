// SSH itself is native. Allow Node-based SSH test doubles to run their script.
if (!process.argv[1] || !require('node:fs').existsSync(process.argv[1])) {
  process.stdout.write(process.env.PX_SSH_PASSWORD || '');
  process.exit(0);
}
