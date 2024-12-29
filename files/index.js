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
        console.log('Received HTTP request:', req.url);
        
        // 检查是否是xray请求
        if (req.url.includes(`/${process.env.LUJING}`)) {
            console.log('Detected xray request, upgrading connection');
            
            // 获取原始socket
            const socket = req.socket;
            
            // 连接到内部服务
            const clientSocket = net.connect({
                port: process.env.DUANKOU,
                host: 'localhost'
            }, () => {
                console.log('Connected to xray, forwarding data');
                
                // 设置保持连接
                socket.setKeepAlive(true, 1000);
                clientSocket.setKeepAlive(true, 1000);
                
                // 发送 HTTP/1.1 101 切换协议
                socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                           'Upgrade: websocket\r\n' +
                           'Connection: Upgrade\r\n' +
                           '\r\n');

                // 建立双向管道
                socket.pipe(clientSocket);
                clientSocket.pipe(socket);
            });

            clientSocket.on('error', (err) => {
                console.error('Forward connection error:', err);
                socket.destroy();
            });

            socket.on('error', (err) => {
                console.error('Client socket error:', err);
                clientSocket.destroy();
            });

            clientSocket.on('close', () => {
                console.log('Client socket closed');
                socket.destroy();
            });
            
            socket.on('close', () => {
                console.log('Socket closed');
                clientSocket.destroy();
            });

            // 阻止默认的响应，但不要立即销毁socket
            res.destroy();
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
