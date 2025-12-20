// Simpan sebagai server.js
// Jalankan: npm install express socket.io systeminformation
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const si = require('systeminformation');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('Client terhubung ke monitoring');

    // Interval pengiriman data setiap 1 detik
    const interval = setInterval(async () => {
        try {
            const load = await si.currentLoad();
            const mem = await si.mem();
            const net = await si.networkStats();

            socket.emit('stats_update', {
                cpu: load.currentLoad.toFixed(1),
                ram: ((mem.active / mem.total) * 100).toFixed(1),
                netRecv: (net[0].rx_sec / 1024 / 1024).toFixed(2), // Convert ke MB
                netSend: (net[0].tx_sec / 1024 / 1024).toFixed(2)  // Convert ke MB
            });
        } catch (e) { console.log(e); }
    }, 1000);

    socket.on('disconnect', () => clearInterval(interval));
});

http.listen(3000, () => {
    console.log('Monitor berjalan di http://localhost:3000');
});

