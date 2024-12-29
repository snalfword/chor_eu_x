const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

// 环境变量设置
process.env['CHARUI_KAIGUAN'] = '1';
process.env['ERGOU_KAIGUAN'] = '0';
process.env['ERGOUYAOSHI'] = '';
process.env['LUJING'] = 'vmkkkess';
process.env['WOSHOUMIMA'] = '128a1c04-e0d0-4ba2-bc35-4e3f1dd5a2f0';
process.env['DUANKOU'] = '9328';
process.env['YONGDU'] = '0';

// 运行video程序
async function runVideo() {
    return new Promise((resolve, reject) => {
        const command = `nohup ./video -c ./config.json >/dev/null 2>&1 &`;
        exec(command, (error) => {
            if (error) {
                console.error(`Video running error: ${error}`);
                reject(error);
            } else {
                console.log('Video is running');
                resolve();
            }
        });
    });
}

// 创建HTTP服务器并处理请求
function createServer() {
    const server = http.createServer((req, res) => {
        console.log('Received HTTP request:', req.url, req.method);
        
        // 检查是否是xray请求
        if (req.url.includes(`/${process.env.LUJING}`)) {
            console.log('Detected xray request, method:', req.method);
            
            // 获取原始socket
            const socket = req.socket;
            
            // 连接到内部服务
            const clientSocket = net.connect({
                port: process.env.DUANKOU,
                host: 'localhost'
            }, () => {
                console.log('Connected to xray, forwarding data');
                
                // 设置socket选项
                socket.setNoDelay(true);
                clientSocket.setNoDelay(true);
                socket.setKeepAlive(true, 1000);
                clientSocket.setKeepAlive(true, 1000);

                if (req.method === 'CONNECT') {
                    // 对于CONNECT请求，发送连接建立响应
                    socket.write(
                        'HTTP/1.1 200 Connection Established\r\n' +
                        'Connection: keep-alive\r\n' +
                        '\r\n'
                    );
                } else {
                    // 对于GET请求，转发完整的HTTP请求
                    const fullRequest = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\r\n' +
                        Object.keys(req.headers).map(key => `${key}: ${req.headers[key]}`).join('\r\n') +
                        '\r\n\r\n';
                    
                    clientSocket.write(fullRequest, () => {
                        console.log('Original request forwarded');
                    });
                }
                
                // 建立双向管道
                socket.pipe(clientSocket);
                clientSocket.pipe(socket);
                
                // 恢复数据流
                socket.resume();
            });

            clientSocket.on('connect', () => {
                console.log('Internal connection established');
            });

            clientSocket.on('data', (data) => {
                console.log('Received data from internal service, length:', data.length);
            });

            socket.on('data', (data) => {
                console.log('Received data from client, length:', data.length);
            });

            clientSocket.on('error', (err) => {
                console.error('Forward connection error:', err);
                if (!socket.destroyed) {
                    socket.end();
                }
            });

            socket.on('error', (err) => {
                console.error('Client socket error:', err);
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });

            clientSocket.on('close', () => {
                console.log('Client socket closed');
                if (!socket.destroyed) {
                    socket.end();
                }
            });
            
            socket.on('close', () => {
                console.log('Socket closed');
                if (!clientSocket.destroyed) {
                    clientSocket.end();
                }
            });

            // 暂停socket并阻止默认的响应处理
            socket.pause();
            return;
            
        } else {
            // 普通HTTP请求，返回HTML
            console.log('Serving HTML content');
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block'
            });
            
            fs.createReadStream(path.join(__dirname, 'apps.html')).pipe(res);
        }
    });

    // 添加upgrade事件处理
    server.on('upgrade', (req, socket, head) => {
        console.log('Received upgrade request:', req.url);
        if (req.url.includes(`/${process.env.LUJING}`)) {
            const clientSocket = net.connect({
                port: process.env.DUANKOU,
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

    server.on('error', (err) => {
        console.error('Server error:', err);
    });

    return server;
}

// 主函数
async function main() {
    try {
        // 1. 运行video程序
        await runVideo();
        
        // 2. 创建并启动HTTP服务器
        const server = createServer();
        server.listen(3000, () => {
            console.log('Server is running on port 3000');
        });

    } catch (error) {
        console.error('Error in main:', error);
        process.exit(1);
    }
}

// 启动程序
main().catch(console.error); 
