import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const room101 = await prisma.room.upsert({
    where: { number: "101" },
    update: {},
    create: {
      number: "101",
      name: "Standard",
      floor: "1",
      status: "AVAILABLE",
      // Substitua pelo device_id real da fechadura/tomada Tuya vinculada ao quarto.
      tuyaDeviceId: null,
      tuyaCheckinCommands: JSON.stringify([{ code: "switch_1", value: true }]),
      tuyaCheckoutCommands: JSON.stringify([{ code: "switch_1", value: false }]),
    },
  });

  const room102 = await prisma.room.upsert({
    where: { number: "102" },
    update: {},
    create: {
      number: "102",
      name: "Suite",
      floor: "1",
      status: "AVAILABLE",
      tuyaDeviceId: null,
      tuyaCheckinCommands: JSON.stringify([{ code: "switch_1", value: true }]),
      tuyaCheckoutCommands: JSON.stringify([{ code: "switch_1", value: false }]),
    },
  });

  const guest = await prisma.guest.upsert({
    where: { id: "seed-guest-1" },
    update: {},
    create: {
      id: "seed-guest-1",
      fullName: "João da Silva",
      document: "BI123456789",
      phone: "+244 900 000 000",
      email: "joao.silva@example.com",
    },
  });

  await prisma.reservation.create({
    data: {
      guestId: guest.id,
      roomId: room101.id,
      checkinDate: new Date(),
      checkoutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "BOOKED",
    },
  });

  console.log("Seed concluído:", { room101: room101.number, room102: room102.number, guest: guest.fullName });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
