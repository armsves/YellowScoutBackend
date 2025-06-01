// filepath: /home/armsve/ethGlobalPrague2025/node-wss-cron-job/src/db/prisma.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function upsertLedgerEntry(entry) {
  await prisma.ledgerEntry.upsert({
    where: { id: entry.id },
    update: entry,
    create: entry,
  });
}

async function upsertChannel(channel) {
  await prisma.channel.upsert({
    where: { channelId: channel.channelId },
    update: channel,
    create: channel,
  });
}

module.exports = { upsertLedgerEntry, upsertChannel };