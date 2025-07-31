import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StreamUploadTester {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.chunkSize = 1024 * 1024; // 1MB per chunk
        this.uploadId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async uploadFile(filePath) {
        const fileSize = fs.statSync(filePath).size;
        const fileName = path.basename(filePath);
        const totalChunks = Math.ceil(fileSize / this.chunkSize);

        console.log(`开始上传文件: ${fileName}`);
        console.log(`文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`总分块数: ${totalChunks}`);
        console.log(`上传ID: ${this.uploadId}`);

        const fileStream = fs.createReadStream(filePath);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const chunk = await this.readChunk(fileStream, chunkIndex);

            try {
                const response = await this.uploadChunk(chunk, chunkIndex, totalChunks, fileName, fileSize);
                console.log(`分块 ${chunkIndex + 1}/${totalChunks} 上传成功`);

                if (response.status === 'success' && response.uploadedChunks === totalChunks) {
                    console.log('所有分块上传完成，文件合并中...');
                    console.log('上传结果:', response);
                    return response;
                }
            } catch (error) {
                console.error(`分块 ${chunkIndex + 1} 上传失败:`, error.message);
                throw error;
            }
        }
    }

    async readChunk(stream, chunkIndex) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let bytesRead = 0;
            const targetBytes = this.chunkSize;

            const onData = (chunk) => {
                if (bytesRead + chunk.length <= targetBytes) {
                    chunks.push(chunk);
                    bytesRead += chunk.length;
                } else {
                    const remainingBytes = targetBytes - bytesRead;
                    chunks.push(chunk.slice(0, remainingBytes));
                    bytesRead = targetBytes;
                    stream.pause();
                }
            };

            const onEnd = () => {
                stream.removeListener('data', onData);
                stream.removeListener('end', onEnd);
                stream.removeListener('error', onError);
                resolve(Buffer.concat(chunks));
            };

            const onError = (error) => {
                stream.removeListener('data', onData);
                stream.removeListener('end', onEnd);
                stream.removeListener('error', onError);
                reject(error);
            };

            stream.on('data', onData);
            stream.on('end', onEnd);
            stream.on('error', onError);
        });
    }

    async uploadChunk(chunk, chunkIndex, totalChunks, fileName, fileSize) {
        const headers = {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${this.token}`,
            'x-filename': fileName,
            'x-filesize': fileSize,
            'x-chunk-index': chunkIndex,
            'x-total-chunks': totalChunks,
            'x-upload-id': this.uploadId
        };

        const response = await fetch(`${this.baseUrl}/api/scratch/stream-upload`, {
            method: 'POST',
            headers: headers,
            body: chunk
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传失败 (${response.status}): ${errorText}`);
        }

        return await response.json();
    }

    async getUploadStatus() {
        const response = await fetch(`${this.baseUrl}/api/scratch/upload-status/${this.uploadId}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });
        return await response.json();
    }

    async cancelUpload() {
        const response = await fetch(`${this.baseUrl}/api/scratch/cancel-upload/${this.uploadId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });
        return await response.json();
    }
}

// 测试函数
async function testStreamUpload() {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const token = process.env.AUTH_TOKEN || 'your-auth-token';

    if (!token || token === 'your-auth-token') {
        console.error('请设置 AUTH_TOKEN 环境变量');
        process.exit(1);
    }

    const tester = new StreamUploadTester(baseUrl, token);

    // 创建测试文件
    const testFilePath = path.join(__dirname, 'test-file.txt');
    const testContent = '这是一个测试文件，用于验证流式上传功能。'.repeat(1000); // 约50KB
    fs.writeFileSync(testFilePath, testContent);

    try {
        console.log('开始测试流式上传...');
        const result = await tester.uploadFile(testFilePath);
        console.log('测试成功!');
        console.log('上传结果:', result);
    } catch (error) {
        console.error('测试失败:', error.message);
    } finally {
        // 清理测试文件
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    testStreamUpload().catch(console.error);
}

export default StreamUploadTester;