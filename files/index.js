const { exec } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

process.env['CHARUI_KAIGUAN'] = '1';
process.env['ERGOU_KAIGUAN'] = '0';
process.env['ERGOUYAOSHI'] = '';
process.env['LUJING'] = 'vmkkkess';
process.env['WOSHOUMIMA'] = '128a1c04-e0d0-4ba2-bc35-4e3f1dd5a2f0';
process.env['DUANKOU'] = '9328';
process.env['YONGDU'] = '0';

async function runVideo() {
    return new Promise((resolve, reject) => {
        const command = `nohup ./video -c ./config.json >/dev/null 2>&1 &`;
        exec(command, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function createServer() {
    const server = http.createServer((req, res) => {
        if (req.url.includes(`/${process.env.LUJING}`)) {
            const socket = req.socket;
            
            const clientSocket = net.connect({
                port: 53003,
                host: 'localhost'
            }, () => {
                socket.setNoDelay(true);
                clientSocket.setNoDelay(true);
                socket.setKeepAlive(true, 1000);
                clientSocket.setKeepAlive(true, 1000);

                const wsHeaders = {
                    'Host': req.headers.host,
                    'User-Agent': req.headers['user-agent'],
                    'Accept': '*/*',
                    'Connection': 'Upgrade',
                    'Upgrade': 'websocket',
                    'Sec-WebSocket-Version': req.headers['sec-websocket-version'],
                    'Sec-WebSocket-Key': req.headers['sec-websocket-key']
                };

                const wsRequest = [
                    `${req.method} ${req.url} HTTP/1.1`,
                    ...Object.entries(wsHeaders).map(([key, value]) => `${key}: ${value}`),
                    '',
                    ''
                ].join('\r\n');

                clientSocket.write(wsRequest);

                socket.on('data', (data) => {
                    if (!clientSocket.destroyed) {
                        clientSocket.write(data);
                    }
                });

                clientSocket.on('data', (data) => {
                    if (!socket.destroyed) {
                        socket.write(data);
                    }
                });

                socket.on('end', () => {
                    if (!clientSocket.destroyed) {
                        clientSocket.end();
                    }
                });
                
                clientSocket.on('end', () => {
                    if (!socket.destroyed) {
                        socket.end();
                    }
                });

                socket.pause();
                req.setTimeout(0);
                return;
            });

            clientSocket.on('error', () => {
                if (!socket.destroyed) {
                    socket.end();
                }
            });

            socket.on('error', () => {
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });
        } else {
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            
            fs.createReadStream(path.join(__dirname, 'apps.html')).pipe(res);
        }
    });

    server.on('upgrade', (req, socket, head) => {
        if (req.url.includes(`/${process.env.LUJING}`)) {
            const clientSocket = net.connect({
                port: 53003,
                host: 'localhost'
            }, () => {
                socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                           'Upgrade: websocket\r\n' +
                           'Connection: Upgrade\r\n' +
                           '\r\n');
                
                clientSocket.write(head);
                clientSocket.pipe(socket);
                socket.pipe(clientSocket);
            });
        }
    });

    return server;
}

async function main() {
    try {
        await runVideo();
        
        const server = createServer();
        server.listen(3000);

    } catch (error) {
        process.exit(1);
    }
}

main().catch(() => {});
