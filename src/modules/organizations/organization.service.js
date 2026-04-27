import { OrganizationRepository } from "./organization.repository.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { prisma } from "../../config/database.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../../shared/errors/AppError.js";

const orgRepo = new OrganizationRepository();

const MAX_ORGANIZATIONS_PER_USER = 1;

// ─── Helpers privés ───────────────────────────────────────────
const generateLoginId = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

const generateMemberNumber = () => `MBR${Date.now().toString().slice(-6)}`;

export class OrganizationService {
  // ─── Créer une organisation ───────────────────────────────────
  async createOrganization(ownerId, data, file) {
    const ownedCount = await orgRepo.countActiveByOwner(ownerId);

    if (ownedCount >= MAX_ORGANIZATIONS_PER_USER) {
      throw new ConflictError(
        `Vous avez atteint la limite de ${MAX_ORGANIZATIONS_PER_USER} organisations. ` +
          `Désactivez une organisation existante pour en créer une nouvelle.`,
      );
    }

    const user = await orgRepo.findOwnerPermissions(ownerId);
    if (!user?.canCreateOrganization) {
      throw new ForbiddenError(
        "Vous n'êtes pas autorisé à créer une organisation.",
      );
    }

    const { settings, wallet, ...orgData } = data;

    const uploader = new MediaUploader();
    let logoUrl = null;

    if (file) {
      logoUrl = await uploader.upload(
        file,
        "organizations/logos",
        `org_${orgData.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
      );
    }

    try {
      const organization = await prisma.$transaction(async (tx) => {
        // 1. Settings
        const orgSettings = await tx.organizationSettings.create({
          data: {
            allowPartialPayments: settings?.allowPartialPayments ?? false,
            autoReminders: settings?.autoReminders ?? true,
            reminderDays: settings?.reminderDays ?? [1, 3, 7],
            emailNotifications: settings?.emailNotifications ?? true,
            smsNotifications: settings?.smsNotifications ?? false,
            whatsappNotifications: settings?.whatsappNotifications ?? false,
            sessionTimeout: settings?.sessionTimeout ?? 60,
          },
        });

        // 2. Organisation
        const newOrg = await tx.organization.create({
          data: {
            ...orgData,
            logo: logoUrl,
            ownerId,
            settingsId: orgSettings.id,
          },
          include: {
            owner: {
              select: { id: true, prenom: true, nom: true, email: true },
            },
            settings: true,
          },
        });

        // 3. Wallet
        const initialBalance = parseFloat(wallet?.initialBalance) || 0;
        await tx.organizationWallet.create({
          data: {
            organizationId: newOrg.id,
            initialBalance,
            currentBalance: initialBalance,
            totalIncome: initialBalance > 0 ? initialBalance : 0,
            totalExpenses: 0,
            currency: newOrg.currency || "XOF",
          },
        });

        // 4. Abonnement FREE par défaut
        await tx.subscription.create({
          data: {
            organizationId: newOrg.id,
            plan: "FREE",
            status: "ACTIVE",
            startDate: new Date(),
            maxMembers: 50,
            currentUsage: 1,
            price: 0,
            currency: "XOF",
          },
        });

        // 5. Membership du propriétaire
        await tx.membership.create({
          data: {
            userId: ownerId,
            organizationId: newOrg.id,
            role: "ADMIN",
            loginId: generateLoginId(),
            memberNumber: generateMemberNumber(),
            status: "ACTIVE",
          },
        });

        // 6. Audit log
        await tx.auditLog.create({
          data: {
            organizationId: newOrg.id,
            userId: ownerId,
            action: "CREATE_ORGANIZATION",
            resource: "Organization",
            resourceId: newOrg.id,
            details: {
              organizationName: newOrg.name,
              walletCreated: true,
              initialBalance,
            },
          },
        });

        return newOrg;
      });

      return organization;
    } catch (error) {
      if (logoUrl) {
        await uploader.deleteByUrl(logoUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Obtenir une organisation ─────────────────────────────────
  async getOrganizationById(organizationId, userId) {
    const { organization, membership } = await orgRepo.findByIdWithDetails(
      organizationId,
      userId,
    );

    if (!organization) throw new NotFoundError("Organisation");
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    return {
      ...organization,
      userRole: membership.role,
      userMembership: membership,
    };
  }

  // ─── Organisations de l'utilisateur ──────────────────────────
  async getUserOrganizations(userId) {
    const memberships = await orgRepo.findUserOrganizations(userId);
    return memberships.map((m) => ({
      ...m.organization,
      userRole: m.role,
    }));
  }

  // ─── Organisations inactives ──────────────────────────────────
  async getInactiveOrganizations(userId, page = 1, limit = 10) {
    const { organizations, total } = await orgRepo.findInactiveOrganizations(
      userId,
      { page, limit },
    );

    return {
      organizations: organizations.map((org) => ({
        ...org,
        userRole: org.members[0]?.role,
        userMembershipStatus: org.members[0]?.status,
        members: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // ─── Rechercher des organisations ────────────────────────────
  async searchOrganizations(userId, query) {
    const { organizations, total } = await orgRepo.searchOrganizations(
      userId,
      query,
    );

    return {
      organizations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  // ─── Modifier une organisation ────────────────────────────────
  async updateOrganization(organizationId, userId, data, file) {
    const membership = await orgRepo.findAdminMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour modifier cette organisation",
      );
    }

    const existing = await orgRepo.findByIdWithLogo(organizationId);

    const uploader = new MediaUploader();
    let newLogoUrl = null;

    if (file) {
      newLogoUrl = await uploader.upload(
        file,
        "organizations/logos",
        `org_${organizationId}_${Date.now()}`,
      );
      if (existing?.logo) {
        await uploader.deleteByUrl(existing.logo).catch(() => {});
      }
    }

    try {
      return orgRepo.updateOrganization(organizationId, {
        ...data,
        ...(newLogoUrl && { logo: newLogoUrl }),
      });
    } catch (error) {
      if (newLogoUrl) {
        await uploader.deleteByUrl(newLogoUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Modifier les settings ────────────────────────────────────
  async updateOrganizationSettings(organizationId, userId, data) {
    const membership = await orgRepo.findAdminMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour modifier les paramètres",
      );
    }

    const organization = await orgRepo.findByIdWithSettings(organizationId);
    if (!organization) throw new NotFoundError("Organisation");

    return orgRepo.updateSettings(organization.settingsId, data);
  }

  // ─── Désactiver une organisation ──────────────────────────────
  async deactivateOrganization(organizationId, userId) {
    const organization = await orgRepo.findByIdWithWallet(organizationId);
    if (!organization) throw new NotFoundError("Organisation");

    if (organization.ownerId !== userId) {
      throw new ForbiddenError(
        "Seul le propriétaire peut désactiver l'organisation",
      );
    }

    if (organization.wallet?.currentBalance !== 0) {
      throw new ConflictError(
        `Impossible de désactiver : le portefeuille contient ` +
          `${organization.wallet.currentBalance} ${organization.wallet.currency}. ` +
          `Veuillez d'abord solder le compte.`,
      );
    }

    return orgRepo.setActiveStatus(organizationId, false);
  }

  // ─── Réactiver une organisation ───────────────────────────────
  async reactivateOrganization(organizationId, userId) {
    const organization = await orgRepo.findByIdWithWallet(organizationId);
    if (!organization) throw new NotFoundError("Organisation");

    if (organization.ownerId !== userId) {
      throw new ForbiddenError(
        "Seul le propriétaire peut réactiver l'organisation",
      );
    }
    if (organization.isActive) {
      throw new ConflictError("L'organisation est déjà active");
    }

    const ownedCount = await orgRepo.countActiveByOwner(userId);
    if (ownedCount >= MAX_ORGANIZATIONS_PER_USER) {
      throw new ConflictError(
        `Vous avez atteint la limite de ${MAX_ORGANIZATIONS_PER_USER} organisations actives. ` +
          `Désactivez une organisation existante avant de réactiver celle-ci.`,
      );
    }

    return orgRepo.setActiveStatus(organizationId, true);
  }

  // ─── Statistiques ─────────────────────────────────────────────
  async getOrganizationStats(organizationId, userId) {
    const membership = await orgRepo.findActiveMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    return orgRepo.getStats(organizationId);
  }

  // ─── Solder le wallet ─────────────────────────────────────────
  async settleWallet(organizationId, userId) {
    const organization = await orgRepo.findByIdWithWallet(organizationId);
    if (!organization) throw new NotFoundError("Organisation");

    if (organization.ownerId !== userId) {
      throw new ForbiddenError(
        "Seul le propriétaire peut solder le portefeuille",
      );
    }
    if (!organization.wallet) throw new NotFoundError("Portefeuille");
    if (organization.wallet.currentBalance === 0) {
      throw new ConflictError("Le portefeuille est déjà soldé (solde = 0)");
    }

    const previousBalance = organization.wallet.currentBalance;
    const currency = organization.wallet.currency;

    return prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.organizationWallet.update({
        where: { organizationId },
        data: { currentBalance: 0 },
      });

      await tx.transaction.create({
        data: {
          organizationId,
          type: "WALLET_SETTLEMENT",
          amount: Math.abs(previousBalance),
          paymentStatus: "COMPLETED",
          paymentMethod: "INTERNAL",
          reference: `SETTLE-${organizationId}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)
            .toUpperCase()}`,
          description: `Solde du portefeuille — Balance précédente : ${previousBalance} ${currency}`,
          metadata: {
            previousBalance,
            newBalance: 0,
            settledBy: userId,
            settledAt: new Date().toISOString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "SETTLE_WALLET",
          resource: "OrganizationWallet",
          resourceId: updatedWallet.id,
          details: { previousBalance, newBalance: 0, currency },
        },
      });

      return {
        wallet: updatedWallet,
        previousBalance,
        newBalance: 0,
        currency,
        message: `Portefeuille soldé. Solde précédent : ${previousBalance} ${currency}`,
      };
    });
  }

  // ─── Mettre à jour le wallet ──────────────────────────────────
  async updateWallet(organizationId, userId, data) {
    const [organization, membership] = await Promise.all([
      orgRepo.findByIdWithWallet(organizationId),
      orgRepo.findAdminMembership(userId, organizationId),
    ]);

    if (!organization) throw new NotFoundError("Organisation");
    if (!membership && organization.ownerId !== userId) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour modifier le portefeuille",
      );
    }
    if (!organization.wallet) throw new NotFoundError("Portefeuille");

    const previousState = {
      currentBalance: organization.wallet.currentBalance,
      initialBalance: organization.wallet.initialBalance,
      totalIncome: organization.wallet.totalIncome,
      totalExpenses: organization.wallet.totalExpenses,
    };

    return prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.organizationWallet.update({
        where: { organizationId },
        data: {
          ...(data.initialBalance !== undefined && {
            initialBalance: data.initialBalance,
          }),
          ...(data.currentBalance !== undefined && {
            currentBalance: data.currentBalance,
          }),
          ...(data.totalIncome !== undefined && {
            totalIncome: data.totalIncome,
          }),
          ...(data.totalExpenses !== undefined && {
            totalExpenses: data.totalExpenses,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "UPDATE_WALLET",
          resource: "OrganizationWallet",
          resourceId: updatedWallet.id,
          details: {
            previousState,
            newState: {
              currentBalance: updatedWallet.currentBalance,
              initialBalance: updatedWallet.initialBalance,
              totalIncome: updatedWallet.totalIncome,
              totalExpenses: updatedWallet.totalExpenses,
            },
            updatedFields: Object.keys(data),
          },
        },
      });

      return updatedWallet;
    });
  }
}
