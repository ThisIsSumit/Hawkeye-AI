import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany();
  for (const user of users) {
    console.log(`User: ${user.email}`);
    console.log(`Hash: ${user.passwordHash}`);
    const pass = user.email.split('@')[0] + '123';
    const isValid = await bcrypt.compare(pass, user.passwordHash);
    console.log(`Is password "${pass}" valid?`, isValid);
    console.log('---');
  }
} catch (e) {
  console.error('Error:', e);
} finally {
  await prisma.$disconnect();
}
