module.exports = {
  apps: [
    {
      name: "creativelead-api",
      cwd: "/var/www/creativelead/api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3070"
      }
    },
    {
      name: "creativelead-dashboard",
      cwd: "/var/www/creativelead/dashboard/.next/standalone",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "3040",
        HOSTNAME: "127.0.0.1"
      }
    }
  ]
};
