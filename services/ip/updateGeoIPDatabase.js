/**
 * 动态重新加载GeoIP数据库
 * 不需要重启应用，只重新加载数据库
 */
const reloadDatabase = async () => {
  try {
    console.log('准备动态加载GeoIP数据库...');

    // 等待1秒，以便控制台输出完整
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('正在动态加载MaxMind GeoIP数据库...');

    // 动态导入ipLocation模块
    const ipLocationModule = await import('./ipLocation.js');

    // 重新初始化MaxMind GeoIP数据库
    console.log('正在初始化MaxMind GeoIP数据库...');
    await ipLocationModule.default.loadConfigFromDB();

    console.log('\n' + '*'.repeat(60));
    console.log('*      MaxMind GeoIP 数据库已成功动态加载               *');
    console.log('*      应用继续使用新的数据库，无需重启                 *');
    console.log('*'.repeat(60) + '\n');

    return { success: true, message: 'GeoIP数据库已成功动态加载，无需重启应用' };
  } catch (error) {
    console.error('动态加载GeoIP数据库时出错:', error);
    return { success: false, message: `动态加载GeoIP数据库失败: ${error.message}` };
  }
};

// 导出方法供其他模块使用
export default reloadDatabase;