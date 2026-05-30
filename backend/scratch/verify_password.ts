import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@hawkeye.ai' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('User found:', user.email);
    console.log('Password hash:', user.passwordHash);
    
    const isValid = await bcrypt.compare('admin123', user.passwordHash);
    console.log('Is password "admin123" valid?', isValid);

    const isValidAgain = await bcrypt.compare('admin123', user.passwordHash);
    console.log('Is password "admin123" valid (again)?', isValidAgain);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
