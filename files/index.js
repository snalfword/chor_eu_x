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
            console.log('Detected xray request, forwarding to port 53003');
            
            // 获取原始socket
            const socket = req.socket;
            
            // 连接到内部服务
            const clientSocket = net.connect({
                port: 53003,
                host: 'localhost'
            }, () => {
                console.log('Connected to internal service');
                
                // 设置socket选项
                socket.setNoDelay(true);
                clientSocket.setNoDelay(true);
                
                // 设置无限超时
                socket.setTimeout(0);
                clientSocket.setTimeout(0);
                
                // 直接转发数据
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

            // 当任一端关闭时，关闭另一端
            clientSocket.on('end', () => socket.end());
            socket.on('end', () => clientSocket.end());
            
            // 暂停socket以防止默认的响应处理
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
                port: 53003,
                host: 'localhost'
            }, () => {
                // 直接转发原始数据
                clientSocket.write(head);
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
