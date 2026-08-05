const http = require('http');

const URL = 'http://localhost:8080/api/sensor-data';
const DURATION_MS = 15000; // Run for 15 seconds
const CONCURRENCY = 50;    // 50 parallel asynchronous workers

let successCount = 0;
let failCount = 0;
let isRunning = true;
let totalRequestsSent = 0;

function generatePayload(seq) {
    return JSON.stringify({
        nodeId: "node-chaos",
        meshId: "chaos-abcd",
        ipv6Address: "fd5e:a726:ec55:ee12::chaos",
        bootId: "chaos-boot",
        sequenceNumber: seq,
        temperature: 24.5 + Math.random(),
        humidity: 45.2 + Math.random(),
        co2: 450.0 + Math.random() * 10,
        tvoc: 120.0 + Math.random() * 5,
        eco2: 460.0 + Math.random() * 10,
        pm1_0: 5.2,
        pm2_5: 12.4,
        pm4_0: 15.1,
        pm10: 18.3,
        lightIntensity: 320 + Math.random() * 20,
        healthStatus: 255
    });
}

let firstErrorLogged = false;

function sendRequest(seq) {
    return new Promise((resolve) => {
        const payloadData = generatePayload(seq);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payloadData)
            },
            // Keep-alive agent for high throughput
            agent: new http.Agent({ keepAlive: true })
        };

        const req = http.request(URL, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201 || res.statusCode === 200) {
                    successCount++;
                } else {
                    failCount++;
                    if (!firstErrorLogged) {
                        console.log(`\n[DEBUG] First dropped request: HTTP ${res.statusCode} - ${data}\n`);
                        firstErrorLogged = true;
                    }
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            failCount++;
            if (!firstErrorLogged) {
                console.log(`\n[DEBUG] First connection error: ${err.message}\n`);
                firstErrorLogged = true;
            }
            resolve();
        });

        req.write(payloadData);
        req.end();
    });
}

async function worker() {
    while (isRunning) {
        totalRequestsSent++;
        await sendRequest(totalRequestsSent);
    }
}

// Pre-warm the JVM with a single request to force Java classloading and JIT compilation
console.log(`🔥 Sending single pre-warm ping to JVM...`);
sendRequest(0).catch(() => {}).finally(() => {
    setTimeout(() => {
        console.log(`🚀 Starting High-Concurrency Stress Worker...`);
        console.log(`⚡ Concurrency: ${CONCURRENCY} parallel streams (with 1-second ramp-up)`);

        // Start workers with a slight stagger to prevent TCP SYN-flooding Nginx on the first millisecond
        for (let i = 0; i < CONCURRENCY; i++) {
            setTimeout(() => {
                worker();
            }, i * 20); // 20ms stagger = 1 second total ramp up
        }

        // Reset metrics after 3 seconds of warm-up load to measure steady-state reliability
        setTimeout(() => {
            console.log(`\n✅ Warm-up complete. Resetting metrics for steady-state chaos test...\n`);
            successCount = 0;
            failCount = 0;
        }, 3000);

        // Periodically log status
        const statusInterval = setInterval(() => {
            console.log(`   📊 In-flight Stats -> Success: ${successCount} | Dropped: ${failCount}`);
        }, 1000);

        // Stop after DURATION_MS
        setTimeout(() => {
            isRunning = false;
            clearInterval(statusInterval);
            
            // Give inflight requests a tiny bit to finish
            setTimeout(() => {
                console.log(`\n==================================================`);
                console.log(`🏁 STRESS TEST COMPLETED`);
                console.log(`✅ Total Success: ${successCount}`);
                console.log(`❌ Total Dropped: ${failCount}`);
                console.log(`==================================================`);
                
                // Exit with failure code if any dropped
                if (failCount > 0) {
                    process.exit(1);
                } else {
                    process.exit(0);
                }
            }, 1000);
        }, DURATION_MS);
    }, 1000); // 1 second pause after pre-warm
});
