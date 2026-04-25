import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('[prisma] DATABASE_URL 未配置，请检查根目录或 apps/api 目录下的 .env 文件')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }
