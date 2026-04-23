import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class AuthRepository extends BaseRepository {
  constructor() {
    super(prisma.user);
  }

  // ─── Users ────────────────────────────────────────────────────

  async findByPhone(phone) {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithMemberships(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        phone: true,
        role: true,
        gender: true,
        avatar: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                logo: true,
                currency: true,
              },
            },
          },
        },
      },
    });
  }

  async createUser(data) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        gender: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }

  async updateProfile(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        gender: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });
  }

  async updateCanCreateOrganization(userId, canCreateOrganization) {
    return prisma.user.update({
      where: { id: userId },
      data: { canCreateOrganization },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        role: true,
        avatar: true,
        gender: true,
        isActive: true,
        canCreateOrganization: true,
        createdAt: true,
      },
    });
  }

  async updateLastLogin(id) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  // ─── Refresh Tokens ───────────────────────────────────────────

  async createRefreshToken(data) {
    return prisma.refreshToken.create({ data });
  }

  async findRefreshToken(token) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeRefreshToken(token) {
    return prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserTokens(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async cleanupTokens() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, createdAt: { lt: yesterday } },
        ],
      },
    });
  }

  // ─── Membres provisoires ──────────────────────────────────────

  async findProvisionalMemberships(phone) {
    return prisma.membership.findMany({
      where: {
        provisionalPhone: phone,
        userId: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            logo: true,
            currency: true,
          },
        },
      },
    });
  }

  async linkMembershipToUser(membershipId, userId) {
    return prisma.membership.update({
      where: { id: membershipId },
      data: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            logo: true,
            currency: true,
          },
        },
      },
    });
  }

  // ─── Audit Log ────────────────────────────────────────────────

  async createAuditLog(data) {
    return prisma.auditLog.create({ data });
  }
}