# 测试分析接口的PowerShell脚本

# 基础配置
$baseUrl = "http://localhost:3000/analytics"  # 根据实际情况修改端口
$headers = @{
    "Content-Type" = "application/json"
}

# 生成随机的fingerprint (模拟FingerprintJS)
function Get-RandomFingerprint {
    $random = -join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
    return $random
}

# 生成随机的visitor_id
function Get-RandomVisitorId {
    return [guid]::NewGuid().ToString()
}

# 测试场景1: 新设备首次访问
Write-Host "`n测试场景1: 新设备首次访问" -ForegroundColor Green
$fingerprint1 = Get-RandomFingerprint
$visitor1 = Get-RandomVisitorId

$body1 = @{
    visitor_id = $visitor1
    fingerprint = $fingerprint1
    hostname = "test.zerocat.dev"
    screen = "1920x1080"
    language = "zh-CN"
    url = "https://zerocat.dev/project/123"
    referrer = "https://google.com/search?q=zerocat"
    page_title = "测试项目 - ZeroCat"
    target_type = "project"
    target_id = 123
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/send" -Method Post -Headers $headers -Body $body1
    Write-Host "成功: 新设备访问已记录" -ForegroundColor Green
    Write-Host ($response1 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "错误: 新设备访问记录失败" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# 暂停1秒
Start-Sleep -Seconds 1

# 测试场景2: 同一设备不同页面
Write-Host "`n测试场景2: 同一设备访问不同页面" -ForegroundColor Green
$body2 = @{
    visitor_id = $visitor1
    fingerprint = $fingerprint1
    hostname = "test.zerocat.dev"
    screen = "1920x1080"
    language = "zh-CN"
    url = "https://zerocat.dev/user/456"
    referrer = "https://zerocat.dev/project/123"
    page_title = "用户主页 - ZeroCat"
    target_type = "user"
    target_id = 456
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/send" -Method Post -Headers $headers -Body $body2
    Write-Host "成功: 同一设备新页面访问已记录" -ForegroundColor Green
    Write-Host ($response2 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "错误: 同一设备新页面访问记录失败" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# 测试场景3: 不同设备访问相同页面
Write-Host "`n测试场景3: 不同设备访问相同页面" -ForegroundColor Green
$fingerprint2 = Get-RandomFingerprint
$visitor2 = Get-RandomVisitorId

$body3 = @{
    visitor_id = $visitor2
    fingerprint = $fingerprint2
    hostname = "test.zerocat.dev"
    screen = "2560x1440"  # 不同的屏幕分辨率
    language = "en-US"    # 不同的语言
    url = "https://zerocat.dev/project/123"  # 相同的页面
    referrer = "https://github.com"
    page_title = "Test Project - ZeroCat"
    target_type = "project"
    target_id = 123
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "$baseUrl/send" -Method Post -Headers $headers -Body $body3
    Write-Host "成功: 不同设备访问已记录" -ForegroundColor Green
    Write-Host ($response3 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "错误: 不同设备访问记录失败" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# 测试场景4: 查询统计数据
Write-Host "`n测试场景4: 查询统计数据" -ForegroundColor Green
$startDate = [DateTime]::Now.AddDays(-1).ToString("yyyy-MM-dd")
$endDate = [DateTime]::Now.AddDays(1).ToString("yyyy-MM-dd")

try {
    # 查询所有数据
    $statsAll = Invoke-RestMethod -Uri "$baseUrl/stats?start_at=$startDate&end_at=$endDate" -Method Get
    Write-Host "成功: 查询所有统计数据" -ForegroundColor Green
    Write-Host "总事件数: $($statsAll.data.Length)"

    # 按fingerprint查询
    $statsDevice = Invoke-RestMethod -Uri "$baseUrl/stats?start_at=$startDate&end_at=$endDate&fingerprint=$fingerprint1" -Method Get
    Write-Host "成功: 查询特定设备的统计数据" -ForegroundColor Green
    Write-Host "设备事件数: $($statsDevice.data.Length)"
} catch {
    Write-Host "错误: 查询统计数据失败" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n测试完成!" -ForegroundColor Green