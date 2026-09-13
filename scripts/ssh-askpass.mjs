// Only the server's SSH child receives this variable, never Codex.
process.stdout.write(process.env.PX_SSH_PASSWORD || '');
