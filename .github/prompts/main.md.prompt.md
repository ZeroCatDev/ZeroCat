---
agent: agent
---
项目在部署时只包含一个数据库环境变量，所有配置均从src\services\config\zcconfig.js中读取，配置项在src\services\config\configTypes.js中定义。
项目使用prisma，postgresql，不使用任何外键，关系由prisma管理。
我不需要你编写各种文档文件，如果有必要的说明直接输出即可，如果创建了新的接口，你需要给出其位置（注意接口没用/api前缀），调用方法，传入值和返回值示例，直接使用代码块包裹在输出中，不需要变成curl。
你需要严格遵守javascript的最佳实践，代码风格参考现有代码，并且要考虑安全性和性能，不要创建太多文件，复用现有代码。