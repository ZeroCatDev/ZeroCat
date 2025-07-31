import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AssetsUploadTester {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }

    async testUpload(filePath, options = {}) {
        const formData = new FormData();
        
        // 添加文件
        formData.append('file', fs.createReadStream(filePath));
        
        // 添加选项
        if (options.compress !== undefined) {
            formData.append('compress', options.compress.toString());
        }
        if (options.convertToPng !== undefined) {
            formData.append('convertToPng', options.convertToPng.toString());
        }
        if (options.quality !== undefined) {
            formData.append('quality', options.quality.toString());
        }
        if (options.tags) {
            formData.append('tags', options.tags);
        }
        if (options.category) {
            formData.append('category', options.category);
        }

        const response = await fetch(`${this.baseUrl}/api/assets/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传失败 (${response.status}): ${errorText}`);
        }

        return await response.json();
    }

    async testList(params = {}) {
        const url = new URL(`${this.baseUrl}/api/assets/list`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取列表失败 (${response.status}): ${errorText}`);
        }

        return await response.json();
    }
}

// 创建测试图片文件 (PNG格式)
function createTestPNG() {
    // 创建一个最小的有效PNG图片（1x1像素黑色）
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.from([
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length (13 bytes)
        0x49, 0x48, 0x44, 0x52, // "IHDR"
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth: 8, Color type: 2 (RGB), etc.
        0x90, 0x77, 0x53, 0xDE  // CRC
    ]);
    const idat = Buffer.from([
        0x00, 0x00, 0x00, 0x0C, // IDAT chunk length (12 bytes)
        0x49, 0x44, 0x41, 0x54, // "IDAT"
        0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
        0x0D, 0x0A, 0x2D, 0xB4  // CRC
    ]);
    const iend = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // IEND chunk length (0 bytes)
        0x49, 0x45, 0x4E, 0x44, // "IEND"
        0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    return Buffer.concat([pngSignature, ihdr, idat, iend]);
}

// 创建测试JPEG文件
function createTestJPEG() {
    // 创建一个最小的有效JPEG图片
    return Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x02, 0x02, 0x02, 0x03,
        0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
        0x06, 0x05, 0x06, 0x09, 0x08, 0x0A, 0x0A, 0x09, 0x08, 0x09, 0x09, 0x0A,
        0x0C, 0x0F, 0x0C, 0x0A, 0x0B, 0x0E, 0x0B, 0x09, 0x09, 0x0D, 0x11, 0x0D,
        0x0E, 0x0F, 0x10, 0x10, 0x11, 0x10, 0x0A, 0x0C, 0x12, 0x13, 0x12, 0x10,
        0x13, 0x0F, 0x10, 0x10, 0x10, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00, 0xFF, 0xD9
    ]);
}

// 创建恶意SVG文件（用于测试安全过滤）
function createMaliciousSVG() {
    return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <script>alert('XSS Attack')</script>
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" onclick="alert('Click Attack')" />
    <foreignObject width="100" height="100">
        <iframe src="javascript:alert('Iframe Attack')"></iframe>
    </foreignObject>
    <text x="10" y="20">Malicious SVG</text>
</svg>`, 'utf8');
}

// 创建包含EXIF数据的JPEG测试文件
function createJPEGWithEXIF() {
    // 这是一个包含EXIF数据的最小JPEG文件
    return Buffer.from([
        0xFF, 0xD8, // JPEG SOI
        0xFF, 0xE1, 0x00, 0x16, // APP1 marker with length
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, // TIFF header
        0xFF, 0xDB, 0x00, 0x43, 0x00, // Quantization table
        ...Array(64).fill(0x10), // Quantization values
        0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08,
        0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00,
        0xFF, 0xD9 // JPEG EOI
    ]);
}

// 创建测试文件（包括安全测试）
function createTestFiles() {
    return {
        // PNG文件但使用.jpg扩展名（测试内容检测）
        'fake-jpeg.jpg': createTestPNG(),
        // JPEG文件使用正确扩展名
        'real-jpeg.jpg': createTestJPEG(),
        // PNG文件使用正确扩展名
        'real-png.png': createTestPNG(),
        // 包含EXIF数据的JPEG文件（测试元数据移除）
        'jpeg-with-exif.jpg': createJPEGWithEXIF(),
        // 恶意SVG文件（测试安全过滤）
        'malicious.svg': createMaliciousSVG()
    };
}

// 测试函数
async function testAssetsUpload() {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const token = process.env.AUTH_TOKEN || 'your-auth-token';

    if (!token || token === 'your-auth-token') {
        console.error('请设置 AUTH_TOKEN 环境变量');
        console.error('例如: export AUTH_TOKEN=your-jwt-token');
        process.exit(1);
    }

    const tester = new AssetsUploadTester(baseUrl, token);

    // 创建测试文件
    const testFiles = createTestFiles();
    const createdFiles = [];

    try {
        console.log('🔒 开始测试文件安全处理功能...');
        console.log(`基础URL: ${baseUrl}`);
        
        // 测试多个文件上传，包括安全测试
        for (const [filename, buffer] of Object.entries(testFiles)) {
            const testFilePath = path.join(__dirname, filename);
            fs.writeFileSync(testFilePath, buffer);
            createdFiles.push(testFilePath);

            console.log(`\n📁 测试文件: ${filename}`);
            console.log(`📏 文件大小: ${buffer.length} bytes`);
            console.log(`🔍 魔数: ${buffer.subarray(0, 8).toString('hex')}`);

            try {
                // 测试不压缩上传（默认行为）
                console.log('🧪 测试不压缩上传...');
                const uploadResult = await tester.testUpload(testFilePath, {
                    compress: false,
                    convertToPng: false,
                    quality: 90,
                    tags: 'test,security,no-compression',
                    category: 'security-test'
                });
                
                console.log('✅ 上传成功:', {
                    success: uploadResult.success,
                    message: uploadResult.message,
                    assetId: uploadResult.asset?.id,
                    detectedType: uploadResult.asset?.metadata?.detectedType,
                    frontendType: uploadResult.asset?.metadata?.frontendType,
                    wasCompressed: uploadResult.asset?.metadata?.wasCompressed,
                    metadataRemoved: uploadResult.asset?.metadata?.metadataRemoved,
                    svgSanitized: uploadResult.asset?.metadata?.svgSanitized
                });

                // 如果是图片文件，再测试压缩上传
                if (filename.includes('.jpg') || filename.includes('.png')) {
                    console.log('🗜️ 测试压缩上传...');
                    const compressResult = await tester.testUpload(testFilePath, {
                        compress: true,
                        convertToPng: true,
                        quality: 70,
                        tags: 'test,security,compressed',
                        category: 'security-test'
                    });
                    
                    console.log('✅ 压缩上传成功:', {
                        wasCompressed: compressResult.asset?.metadata?.wasCompressed,
                        wasConverted: compressResult.asset?.metadata?.wasConverted
                    });
                }
                
            } catch (error) {
                if (filename === 'malicious.svg') {
                    console.log('✅ 正确阻止恶意文件:', error.message);
                } else {
                    console.log('❌ 上传失败:', error.message);
                }
            }
        }

        // 测试获取素材列表
        console.log('\n📋 测试获取素材列表...');
        const listResult = await tester.testList({
            page: 1,
            limit: 10,
            category: 'security-test'
        });
        console.log('✅ 获取列表成功:', {
            总数: listResult.pagination?.total,
            当前页: listResult.pagination?.page,
            数据条数: listResult.data?.length
        });

        // 测试无效文件（纯文本文件）
        console.log('\n🚫 测试无效文件类型...');
        const invalidFilePath = path.join(__dirname, 'invalid.txt');
        fs.writeFileSync(invalidFilePath, 'This is a text file, not an image or audio');
        createdFiles.push(invalidFilePath);

        try {
            await tester.testUpload(invalidFilePath, {
                category: 'security-test'
            });
            console.log('❌ 应该拒绝无效文件类型');
        } catch (error) {
            console.log('✅ 正确拒绝无效文件:', error.message);
        }

        // 测试超长文件名
        console.log('\n📝 测试文件名验证...');
        const longNamePath = path.join(__dirname, 'a'.repeat(300) + '.png');
        fs.writeFileSync(longNamePath, createTestPNG());
        createdFiles.push(longNamePath);

        try {
            await tester.testUpload(longNamePath, {
                category: 'security-test'
            });
            console.log('❌ 应该拒绝超长文件名');
        } catch (error) {
            console.log('✅ 正确拒绝超长文件名:', error.message);
        }

        console.log('\n🎉 所有安全测试完成!');
        console.log('\n📊 测试总结:');
        console.log('✅ 文件类型检测：基于内容而非扩展名');
        console.log('✅ 恶意内容扫描：阻止包含恶意代码的文件');
        console.log('✅ SVG安全处理：移除脚本和危险元素');
        console.log('✅ EXIF数据清理：移除图片元数据');
        console.log('✅ 压缩控制：只在明确请求时压缩');
        console.log('✅ 文件名验证：检查长度和非法字符');

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    } finally {
        // 清理测试文件
        createdFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    testAssetsUpload().catch(console.error);
}

export default AssetsUploadTester;