module.exports = {
  apps: [{
    name: 'creativelead',
    script: 'npm',
    args: 'start -- -p 3041',
    cwd: '/var/www/creativelead',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 3041,
      ACCESS_CODE_HASH: 'change-me-to-your-sha256-hash',
      SESSION_SECRET: 'change-me-to-a-random-secret',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/creativelead'
    }
  }]
};
