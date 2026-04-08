/**
 * This service handles the transition from the "Vanilla JS" version 
 * to the New Database version.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function migrateLegacyData(jsonData, userId) {
  return await prisma.$transaction(async (tx) => {
    // 1. Migrate Accounts first (to get IDs)
    const accountMap = new Map();
    for (const acc of jsonData.accounts) {
      const newAcc = await tx.account.create({
        data: {
          legacyId: acc.id,
          name: acc.name,
          type: acc.type,
          initialBalance: acc.initialBalance,
          userId: userId
        }
      });
      accountMap.set(acc.id, newAcc.id);
    }

    // 2. Migrate Categories
    const categoryMap = new Map();
    for (const cat of jsonData.minorCategories) {
      const newCat = await tx.category.create({
        data: {
          legacyId: cat.id,
          name: cat.name,
          majorKey: cat.majorKey,
          expectedMonthly: cat.manualExpectedMonthly,
          userId: userId
        }
      });
      categoryMap.set(cat.id, newCat.id);
    }

    // 3. Migrate Transactions with foreign key linking
    await tx.transaction.createMany({
      data: jsonData.transactions.map(t => ({
        date: new Date(t.date),
        amount: t.amount,
        description: t.description,
        accountId: accountMap.get(t.accountId),
        categoryId: categoryMap.get(t.minorCategoryId),
        userId: userId
      }))
    });
  });
}