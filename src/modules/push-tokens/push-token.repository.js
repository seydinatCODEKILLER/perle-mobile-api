import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class PushTokenRepository extends BaseRepository {
  constructor() {
    super(prisma.pushToken);
  }

  async findByToken(token) {
    return prisma.pushToken.findUnique({ where: { token } });
  }

  async findActiveByUserId(userId) {
    return prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
  }

  async findActiveByUserIds(userIds) {
    return prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true, userId: true },
    });
  }

  async upsertToken(userId, { token, platform, deviceName }) {
    return prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, deviceName, isActive: true },
      create: { userId, token, platform, deviceName, isActive: true },
    });
  }

  async deactivateToken(userId, token) {
    return prisma.pushToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  async deactivateAllForUser(userId) {
    return prisma.pushToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async deactivateByToken(token) {
    return prisma.pushToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }
}
