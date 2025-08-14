// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
    // Role awal
    const [adminRole, staffRole] = await Promise.all([
        prisma.role.upsert({
            where: { name: 'ADMIN' },
            update: {},
            create: { name: 'ADMIN' },
        }),
        prisma.role.upsert({
            where: { name: 'STAFF' },
            update: {},
            create: { name: 'STAFF' },
        }),
    ]);

    // Admin default
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@koperasi.local';
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPass, 10);

    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            fullName: 'Administrator',
            passwordHash,
            roleId: adminRole.id,
        },
    });

    // // Anggota contoh
    // const m1 = await prisma.member.upsert({
    //     where: { memberNumber: 'AGT-0001' },
    //     update: {},
    //     create: {
    //         memberNumber: 'AGT-0001',
    //         fullName: 'Siti Rahma',
    //         phone: '0812-1111-2222',
    //         email: 'siti@koperasi.local',
    //         address: 'Makassar',
    //     },
    // });

    // const m2 = await prisma.member.upsert({
    //     where: { memberNumber: 'AGT-0002' },
    //     update: {},
    //     create: {
    //         memberNumber: 'AGT-0002',
    //         fullName: 'Budi Santoso',
    //         phone: '0813-3333-4444',
    //         email: 'budi@koperasi.local',
    //         address: 'Gowa',
    //     },
    // });

    // // Fungsi update saldo anggota
    // async function bumpBalance(memberId, category, delta) {
    //     const field = category === 'WAJIB' ? 'wajibTotal' : 'pokokTotal';
    //     await prisma.memberBalance.upsert({
    //         where: { memberId },
    //         update: { [field]: { increment: delta } },
    //         create: {
    //             memberId,
    //             wajibTotal: category === 'WAJIB' ? delta : 0,
    //             pokokTotal: category === 'POKOK' ? delta : 0,
    //         },
    //     });
    // }

    // const admin = await prisma.user.findFirst({ where: { email: adminEmail } });

    // // Transaksi contoh
    // const txs = [
    //     {
    //         code: 'KTRX-202501-0001',
    //         memberId: m1.id,
    //         category: 'WAJIB',
    //         amount: 20000,
    //         paidAt: new Date('2025-01-05'),
    //         note: 'Januari 2025',
    //         createdById: admin.id,
    //     },
    //     {
    //         code: 'KTRX-202501-0002',
    //         memberId: m1.id,
    //         category: 'POKOK',
    //         amount: 100000,
    //         paidAt: new Date('2025-01-05'),
    //         note: 'Setoran awal',
    //         createdById: admin.id,
    //     },
    //     {
    //         code: 'KTRX-202502-0003',
    //         memberId: m2.id,
    //         category: 'WAJIB',
    //         amount: 20000,
    //         paidAt: new Date('2025-02-03'),
    //         note: 'Februari 2025',
    //         createdById: admin.id,
    //     },
    //     {
    //         code: 'KTRX-202502-0004',
    //         memberId: m2.id,
    //         category: 'POKOK',
    //         amount: 100000,
    //         paidAt: new Date('2025-01-05'),
    //         note: 'Setoran awal',
    //         createdById: admin.id,
    //     },
    // ];

    // for (const t of txs) {
    //     await prisma.transaction.upsert({
    //         where: { code: t.code },
    //         update: {},
    //         create: {
    //             ...t,
    //             amount: t.amount,
    //             paymentMethod: 'CASH',
    //             status: 'POSTED',
    //         },
    //     });
    //     await bumpBalance(t.memberId, t.category, t.amount);
    // }

    console.log('Seeding selesai.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
