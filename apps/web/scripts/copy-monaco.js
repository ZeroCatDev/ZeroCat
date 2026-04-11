const fs = require('fs-extra');
const path = require('path');

// 源路径和目标路径
const sourcePath = path.resolve(__dirname, '../node_modules/monaco-editor/min/vs');
const targetPath = path.resolve(__dirname, '../public/monaco-editor/min/vs');

// 确保目标目录存在
fs.ensureDirSync(path.dirname(targetPath));

// 复制文件
fs.copySync(sourcePath, targetPath, {overwrite: true});

console.log('Monaco Editor files copied successfully to public directory!');
