# MaxMind GeoIP 数据库

## 使用方法

1. 前往 [MaxMind官网](https://www.maxmind.com/) 注册账号，获取免费的 GeoLite2 许可证密钥和账户ID
2. 在数据库中配置以下参数：
   ```sql
   INSERT INTO ow_config (key, value, is_public) VALUES ('maxmind.license_key', '你的许可证密钥', 0);
   INSERT INTO ow_config (key, value, is_public) VALUES ('maxmind.account_id', '你的账户ID', 0);
   INSERT INTO ow_config (key, value, is_public) VALUES ('maxmind.enabled', 'true', 0);
   INSERT INTO ow_config (key, value, is_public) VALUES ('maxmind.update_interval', '30', 0); -- 可选，更新间隔天数
   ```

## 自动下载功能

系统具备以下自动功能：

1. **启动时自动检查**：应用启动时会自动检查数据库文件是否存在，如果不存在且功能已启用，则自动下载
2. **动态加载机制**：数据库下载完成后，系统会自动动态加载新数据库，无需重启应用
3. **热插拔支持**：系统可以在运行时动态更新GeoIP数据库，不会中断任何正在处理的请求
4. **自动加载配置**：从数据库自动加载配置，无需手动配置文件
5. **自动错误处理**：如果数据库文件不存在或下载失败，系统会自动回退到使用模拟数据
6. **进度显示**：下载和解压过程会在控制台显示进度，方便监控

## 数据库配置选项

系统从数据库的 `ow_config` 表中读取配置：

| 键名 | 说明 | 是否必须 |
|------|------|---------|
| maxmind.enabled | 是否启用MaxMind功能 | 是 |
| maxmind.license_key | MaxMind许可证密钥 | 是 |
| maxmind.account_id | MaxMind账户ID | 是 |
| maxmind.update_interval | 数据库更新间隔(天) | 否，默认30天 |

## 数据库文件

数据文件将固定保存在 `data/GeoLite2-City.mmdb` 位置。所有代码已经硬编码使用此位置。

## 数据库管理工具

系统提供了两个管理工具：

### 1. 手动下载数据库

```bash
# 从数据库读取配置并下载最新数据库
node tools/downloadMaxmindDb.js
```

该工具会：
1. 从数据库读取账户ID和许可证密钥
2. 使用官方API下载最新的数据库文件（显示下载进度）
3. 自动解压并安装到正确位置（显示解压进度）

### 2. 定时更新脚本

```bash
# 检查数据库是否需要更新，如需要则自动下载
node tools/updateGeoIPDatabase.js

# 带自动重启参数
node tools/updateGeoIPDatabase.js --restart
```

该脚本会：
1. 检查MaxMind功能是否启用
2. 检查数据库文件是否存在，或文件是否过期需要更新
3. 如果需要更新，则自动调用下载脚本并显示进度
4. 使用`--restart`参数时，下载完成后会自动重启应用

## 设置定时更新

虽然系统启动时会自动检查数据库，但推荐设置定时任务定期更新数据库：

### Linux/Unix (Cron)

```bash
# 编辑crontab
crontab -e

# 添加以下内容，每周一凌晨3点更新，并自动动态加载新数据库
0 3 * * 1 cd /path/to/project && node tools/updateGeoIPDatabase.js --reload >> /path/to/logs/geoip-update.log 2>&1
```

### Windows (计划任务)

1. 创建批处理文件 `update-geoip.bat`：
   ```
   cd D:\path\to\project
   node tools/updateGeoIPDatabase.js --reload
   ```
2. 使用任务计划程序创建计划任务，指向该批处理文件

## 在代码中使用

```javascript
import ipLocation from '../utils/ipLocation.js';

// 更新配置 (将保存到数据库)
await ipLocation.updateConfig({
  enabled: true,
  licenseKey: '你的许可证密钥',
  accountId: '你的账户ID'
});

// 使用IP定位
const location = await ipLocation.getIPLocation('8.8.8.8');
console.log(location);
```

## 注意事项

1. 数据库配置仅保存在数据库中，不使用任何本地配置文件或环境变量
2. 应用启动时会自动检查数据库文件，如果未找到且功能已启用则自动下载
3. 下载完成后系统会自动动态加载新数据库，无需重启应用
4. 系统支持运行时热更新，可以在不中断服务的情况下更新GeoIP数据
5. 数据库路径固定为 `data/GeoLite2-City.mmdb`，不可更改
6. 账户ID和许可证密钥必须正确配置，否则无法下载数据库
7. 如果启用了MaxMind但数据库文件不存在，系统会回退到使用模拟数据
8. GeoLite2数据库每周更新一次，建议设置定时任务定期更新
9. 下载和解压过程在控制台显示实时进度