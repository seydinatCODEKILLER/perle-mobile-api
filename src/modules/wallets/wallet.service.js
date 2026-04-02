import { WalletRepository } from "./wallet.repository.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";

const walletRepo = new WalletRepository();

export class WalletService {
  async getOrCreateWallet(organizationId, currentUserId) {
    // 1. Vérifier le membership (Le service gère l'erreur, pas le repo)
    const membership = await walletRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    // 2. Chercher le wallet existant
    let wallet = await walletRepo.findByOrganizationId(organizationId);
    if (wallet) return wallet;

    // 3. Si non trouvé, vérifier les droits de création
    if (membership.role !== "ADMIN") {
      throw new ForbiddenError(
        "Seul un administrateur peut créer le portefeuille",
      );
    }

    // 4. Créer le wallet avec un audit propre
    wallet = await walletRepo.createWithAudit(organizationId, "XOF", {
      userId: currentUserId,
      membershipId: membership.id,
      details: { currency: "XOF", autoCreated: true },
    });

    return wallet;
  }

  async getWalletById(walletId, organizationId, currentUserId) {
    const membership = await walletRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    const wallet = await walletRepo.findByIdAndOrgId(walletId, organizationId);
    if (!wallet) throw new NotFoundError("Portefeuille non trouvé");

    return wallet;
  }

  async getWalletStats(organizationId, currentUserId) {
    const membership = await walletRepo.findActiveMembership(
      currentUserId,
      organizationId,
    );
    if (!membership) {
      throw new ForbiddenError("Accès non autorisé à cette organisation");
    }

    const wallet = await this.getOrCreateWallet(organizationId, currentUserId);
    const stats = await walletRepo.calculateStats(organizationId);

    return {
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        currentBalance: wallet.currentBalance,
        totalIncome: wallet.totalIncome,
        totalExpenses: wallet.totalExpenses,
      },
      stats,
    };
  }

  async reconcileWallet(
    organizationId,
    currentUserId,
    expectedBalance,
    note = "",
  ) {
    // 1. Vérifier les permissions financières
    const membership = await walletRepo.findActiveMembership(
      currentUserId,
      organizationId,
      ["ADMIN", "FINANCIAL_MANAGER"],
    );

    if (!membership) {
      throw new ForbiddenError("Permissions financières insuffisantes");
    }

    // 2. Récupérer le wallet (sans recréer si erreur de perms, d'où l'appel direct au repo ici)
    const wallet = await walletRepo.findByOrganizationId(organizationId);
    if (!wallet) {
      throw new NotFoundError(
        "Portefeuille non trouvé. Veuillez d'abord initialiser le portefeuille.",
      );
    }

    const difference = expectedBalance - wallet.currentBalance;

    // 3. Vérifier s'il y a une vraie différence (éviter une transaction inutile)
    if (Math.abs(difference) < 0.01) {
      return {
        reconciled: false,
        message: "Aucune différence détectée, le solde est déjà correct",
        balance: wallet.currentBalance,
      };
    }

    // 4. Exécuter la réconciliation via le repo
    const result = await walletRepo.reconcileWithAudit(
      organizationId,
      wallet.id,
      {
        userId: currentUserId,
        membershipId: membership.id,
        difference,
        note,
        previousBalance: wallet.currentBalance,
        expectedBalance,
      },
    );

    return {
      reconciled: true,
      message: "Portefeuille réconcilié avec succès",
      ...result,
    };
  }
}
