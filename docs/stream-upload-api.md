安全提示：部分敏感操作可能要求sudo或2FA验证，请根据`/auth/methods`与本文档的2FA章节处理。
# 流式上传API文档

## 概述

流式上传API支持大文件的分块上传，通过将大文件分割成小块进行上传，提高上传成功率和用户体验。

## API端点

### 1. 流式上传
**POST** `/api/scratch/stream-upload`

#### 请求头
- `Content-Type`: `multipart/form-data`
- `x-filename`: 文件名（必需）
- `x-filesize`: 文件总大小（字节，必需）
- `x-filetype`: 文件类型（可选）
- `x-chunk-index`: 当前分块索引（从0开始，必需）
- `x-total-chunks`: 总分块数（必需）
- `x-upload-id`: 上传唯一标识符（必需）

#### 请求体
- 文件分块的二进制数据

#### 响应
```json
{
  "status": "success",
  "message": "分块 1/5 上传成功",
  "uploadedChunks": 1,
  "totalChunks": 5
}
```

### 2. 获取上传状态
**GET** `/api/scratch/upload-status/:uploadId`

#### 响应
```json
{
  "status": "success",
  "uploadedChunks": 3,
  "chunks": [0, 1, 2]
}
```

### 3. 取消上传
**DELETE** `/api/scratch/cancel-upload/:uploadId`

#### 响应
```json
{
  "status": "success",
  "message": "上传已取消"
}
```

## 使用示例

### JavaScript客户端示例

```javascript
class StreamUploader {
    constructor() {
        this.chunkSize = 1024 * 1024; // 1MB per chunk
        this.uploadId = this.generateUploadId();
    }

    generateUploadId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async uploadFile(file) {
        const totalChunks = Math.ceil(file.size / this.chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);

            try {
                const response = await this.uploadChunk(chunk, i, totalChunks, file);
                console.log(`Chunk ${i + 1}/${totalChunks} uploaded`);

                if (response.status === 'success' && response.uploadedChunks === totalChunks) {
                    console.log('Upload completed:', response);
                    return response;
                }
            } catch (error) {
                console.error(`Error uploading chunk ${i}:`, error);
                throw error;
            }
        }
    }

    async uploadChunk(chunk, chunkIndex, totalChunks, file) {
        const headers = {
            'x-filename': file.name,
            'x-filesize': file.size,
            'x-filetype': file.type,
            'x-chunk-index': chunkIndex,
            'x-total-chunks': totalChunks,
            'x-upload-id': this.uploadId
        };

        const response = await fetch('/api/scratch/stream-upload', {
            method: 'POST',
            headers: headers,
            body: chunk
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async getUploadStatus() {
        const response = await fetch(`/api/scratch/upload-status/${this.uploadId}`);
        return await response.json();
    }

    async cancelUpload() {
        const response = await fetch(`/api/scratch/cancel-upload/${this.uploadId}`, {
            method: 'DELETE'
        });
        return await response.json();
    }
}

// 使用示例
const uploader = new StreamUploader();

// 上传文件
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        try {
            const result = await uploader.uploadFile(file);
            console.log('Upload successful:', result);
        } catch (error) {
            console.error('Upload failed:', error);
        }
    }
});
```

### Python客户端示例

```python
import requests
import os
import uuid

class StreamUploader:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}
        self.chunk_size = 1024 * 1024  # 1MB per chunk
        self.upload_id = str(uuid.uuid4())

    def upload_file(self, file_path):
        file_size = os.path.getsize(file_path)
        total_chunks = (file_size + self.chunk_size - 1) // self.chunk_size

        with open(file_path, 'rb') as f:
            for chunk_index in range(total_chunks):
                chunk_data = f.read(self.chunk_size)

                headers = {
                    **self.headers,
                    'x-filename': os.path.basename(file_path),
                    'x-filesize': file_size,
                    'x-chunk-index': chunk_index,
                    'x-total-chunks': total_chunks,
                    'x-upload-id': self.upload_id
                }

                response = requests.post(
                    f'{self.base_url}/api/scratch/stream-upload',
                    headers=headers,
                    data=chunk_data
                )

                if response.status_code != 200:
                    raise Exception(f'Upload failed: {response.text}')

                result = response.json()
                print(f'Chunk {chunk_index + 1}/{total_chunks} uploaded')

                if result.get('uploadedChunks') == total_chunks:
                    print('Upload completed:', result)
                    return result

    def get_upload_status(self):
        response = requests.get(
            f'{self.base_url}/api/scratch/upload-status/{self.upload_id}',
            headers=self.headers
        )
        return response.json()

    def cancel_upload(self):
        response = requests.delete(
            f'{self.base_url}/api/scratch/cancel-upload/{self.upload_id}',
            headers=self.headers
        )
        return response.json()

# 使用示例
uploader = StreamUploader('http://localhost:3000', 'your-token')
try:
    result = uploader.upload_file('/path/to/your/file.zip')
    print('Upload successful:', result)
except Exception as e:
    print('Upload failed:', e)
```

## 特性

1. **分块上传**: 支持大文件分块上传，提高上传成功率
2. **断点续传**: 支持检查已上传的分块，可以从中断处继续上传
3. **进度跟踪**: 可以查询上传进度
4. **取消上传**: 支持取消正在进行的上传
5. **文件验证**: 自动生成MD5哈希值验证文件完整性
6. **自动清理**: 上传完成后自动清理临时文件

## 限制

- 最大文件大小: 100MB
- 需要用户登录认证
- 支持的文件类型: 所有类型
- 临时文件存储在 `../../cache/stream_upload/` 目录

## 错误处理

常见错误响应：

```json
{
  "status": "error",
  "message": "文件大小超过限制(100MB)"
}
```

```json
{
  "status": "error",
  "message": "缺少必要的文件信息"
}
```

```json
{
  "status": "error",
  "message": "Content-Type必须是multipart/form-data"
}
```