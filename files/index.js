const { exec } = require('child_process');
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
    const server = http.createServer();

    // 处理TCP连接
    server.on('connection', (socket) => {
        let buffer = Buffer.alloc(0);
        let connectionHandled = false;

        socket.on('data', (chunk) => {
            // 如果连接已经被处理，直接返回
            if (connectionHandled) return;

            // 累积数据直到有足够的信息判断请求类型
            buffer = Buffer.concat([buffer, chunk]);
            const data = buffer.toString();

            // 检查是否有足够的数据来判断请求类型
            if (!connectionHandled && 
                (data.includes('\r\n\r\n') || data.includes('\n\n') || buffer.length > 2048)) {
                
                connectionHandled = true;

                // 添加调试日志
                console.log('Analyzing request type...');
                console.log('Request first line:', data.split('\n')[0]);
                
                // 检查是否是浏览器的HTTP请求
                const firstLine = data.split('\n')[0];
                const isHttpRequest = firstLine.includes('HTTP/1.1') || firstLine.includes('HTTP/1.0');
                
                // 检查是否是xray请求（使用环境变量中的路径）
                const isXrayRequest = firstLine.includes(`/${process.env.LUJING}`);
                
                if (isHttpRequest && !isXrayRequest) {
                    console.log('Detected browser request, serving HTML');
                    
                    // 是普通浏览器访问，返回HTML
                    const response = [
                        'HTTP/1.1 200 OK',
                        'Connection: close',
                        'Content-Type: text/html; charset=utf-8',
                        '',
                        ''
                    ].join('\r\n');
                    
                    socket.write(response);
                    
                    const fileStream = fs.createReadStream(path.join(__dirname, 'apps.html'));
                    fileStream.on('error', (error) => {
                        console.error('Error streaming apps.html:', error);
                        socket.end('<html><body><h1>Error loading content</h1></body></html>');
                    });

                    fileStream.on('end', () => {
                        socket.end();
                    });

                    fileStream.pipe(socket);

                    // 清理缓存的数据
                    buffer = Buffer.alloc(0);
                    return;
                }

                console.log('Detected xray request, forwarding to internal port');

                // xray请求或其他请求，转发到xray内部端口
                const clientSocket = net.connect({
                    port: process.env.DUANKOU,
                    host: 'localhost'
                }, () => {
                    console.log('Connected to xray, forwarding data');
                    // 发送已缓存的数据
                    clientSocket.write(buffer);
                    
                    // 清理缓存的数据
                    buffer = Buffer.alloc(0);
                    
                    // 建立双向管道
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
            }
        });

        // 处理连接关闭
        socket.on('close', () => {
            buffer = Buffer.alloc(0);
        });
    });

    // 错误处理
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
