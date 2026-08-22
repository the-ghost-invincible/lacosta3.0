module.exports = {
  apps: [
    {
      name: 'lacosta-api',
      script: 'server/index.js',
      instances: 1, // use 'max' for cluster mode on multi-core
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
    },
  ],
}
