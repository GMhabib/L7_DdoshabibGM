const si = require('systeminformation');

export default async function handler(req, res) {
    try {
        const load = await si.currentLoad();
        const mem = await si.mem();
        const net = await si.networkStats();

        const stats = {
            cpu: load.currentLoad.toFixed(1),
            ram: ((mem.active / mem.total) * 100).toFixed(1),
            netRecv: (net[0].rx_sec / 1024 / 1024).toFixed(2),
            netSend: (net[0].tx_sec / 1024 / 1024).toFixed(2)
        };

        // Menambahkan Header CORS agar bisa diakses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Gagal mengambil data' });
    }
}

