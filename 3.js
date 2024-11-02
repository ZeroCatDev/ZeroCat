const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const json = {}

  async function saveConfig() {
    console.log('Starting to save data to database...');

    try {
      const entries = Object.entries(json);
      const total = entries.length;

      for (let i = 0; i < total; i++) {
        const [key, value] = entries[i];
        const valueToStore = Array.isArray(value) ? value.join(',') : value;

        await prisma.newconfig.upsert({
          create: {
            key: key,
            value: valueToStore,
            user_id:1
          },
          update: {
            key: key,
            value: valueToStore,
            user_id:1
          },
          where:{ key: key}
        });

        // 输出进度信息
        console.log(`Saved ${i + 1} of ${total}: ${key} = ${valueToStore}`);
      }

      console.log('Data saved successfully.');
    } catch (error) {
      console.error('Failed to save data:', error);
    } finally {
      await prisma.$disconnect();
    }
  }

  saveConfig();