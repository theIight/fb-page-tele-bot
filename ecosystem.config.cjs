module.exports = {
  apps: [
    {
      name: "fb-tele-bot",
      script: "./src/index.js",
      cwd: __dirname,
      interpreter: "node",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
