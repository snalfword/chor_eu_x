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
        // 处理普通HTTP请求，返回HTML
        console.log('Received HTTP request:', req.url);
        
        // 设置安全相关的响应头
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        });
        
        fs.createReadStream(path.join(__dirname, 'apps.html')).pipe(res);
    });

    // 处理TCP连接
    server.on('connection', (socket) => {
        let buffer = Buffer.alloc(0);
        let connectionHandled = false;

        socket.on('data', (chunk) => {
            if (connectionHandled) return;

            buffer = Buffer.concat([buffer, chunk]);
            
            if (!connectionHandled && buffer.length > 0) {
                const data = buffer.toString();
                // 检查是否是xray请求
                if (data.includes(`/${process.env.LUJING}`)) {
                    connectionHandled = true;
                    console.log('Detected xray request, forwarding to internal port');
                    
                    const clientSocket = net.connect({
                        port: process.env.DUANKOU,
                        host: 'localhost'
                    }, () => {
                        console.log('Connected to xray, forwarding data');
                        clientSocket.write(buffer);
                        buffer = Buffer.alloc(0);
                        socket.pipe(clientSocket);
                        clientSocket.pipe(socket);
                    });

                    clientSocket.on('error', (err) => {
                        console.error('Forward connection error:', err);
                        socket.end();
                    });

                    socket.on('error', (err) => {
                        console.error('Client socket error:', err);
                        clientSocket.end();
                    });

                    clientSocket.on('end', () => socket.end());
                    socket.on('end', () => clientSocket.end());
                }
            }
        });

        socket.on('close', () => {
            buffer = Buffer.alloc(0);
            connectionHandled = false;
        });
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
