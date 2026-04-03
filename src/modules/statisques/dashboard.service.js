import { DashboardRepository } from "./dashboard.repository.js";
import { AdminDashboardService } from "./admin.dashboard.service.js";
import { FinancialDashboardService } from "./financial.dashboard.service.js";
import { MemberDashboardService } from "./member.dashboard.service.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";

const repo = new DashboardRepository();

const requireMembership = async (organizationId, userId) => {
  const membership = await repo.findActiveMembership(userId, organizationId);
  if (!membership)
    throw new ForbiddenError(
      "Vous n'êtes pas membre actif de cette organisation",
    );
  return membership;
};

export class DashboardService {
  constructor() {
    this.adminService = new AdminDashboardService(repo);
    this.financialService = new FinancialDashboardService(repo);
    this.memberService = new MemberDashboardService(repo);
  }

  async getManagementDashboard(organizationId, currentUserId) {
    const membership = await requireMembership(organizationId, currentUserId);
    if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      throw new ForbiddenError(
        "Permissions insuffisantes pour accéder à l'espace de gestion.",
      );
    }
    return membership.role === "ADMIN"
      ? this.adminService.getDashboardData(organizationId)
      : this.financialService.getDashboardData(organizationId);
  }

  async getPersonalDashboard(organizationId, currentUserId) {
    const membership = await requireMembership(organizationId, currentUserId);
    return this.memberService.getDashboardData(organizationId, membership.id);
  }

  async getAutoDashboard(organizationId, currentUserId, space = "management") {
    const membership = await requireMembership(organizationId, currentUserId);

    if (space === "personal") {
      return this.memberService.getDashboardData(organizationId, membership.id);
    }

    if (space === "management") {
      if (!["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
        throw new ForbiddenError(
          "Vous n'avez pas accès à l'espace de gestion.",
        );
      }
      const data =
        membership.role === "ADMIN"
          ? await this.adminService.getDashboardData(organizationId)
          : await this.financialService.getDashboardData(organizationId);
      return data;
    }
    throw new Error(`Espace non reconnu: ${space}`);
  }

  async getDefaultDashboard(organizationId, currentUserId) {
    const membership = await requireMembership(organizationId, currentUserId);

    if (membership.role === "MEMBER") {
      return {
        redirectTo: "personal",
        data: await this.memberService.getDashboardData(
          organizationId,
          membership.id,
        ),
      };
    }

    if (["ADMIN", "FINANCIAL_MANAGER"].includes(membership.role)) {
      const data =
        membership.role === "ADMIN"
          ? await this.adminService.getDashboardData(organizationId)
          : await this.financialService.getDashboardData(organizationId);
      return { redirectTo: "management", data };
    }
    throw new Error(`Rôle non reconnu: ${membership.role}`);
  }
}
