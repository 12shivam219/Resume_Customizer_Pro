module.exports = {
  apps: [
    {
      name: 'resume-customizer-pro',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2/error.log',
      out_file: './logs/pm2/out.log',
      merge_logs: true,
      max_memory_restart: '512M',
    },
  ],
};
