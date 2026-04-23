import { prisma } from "../../config/database.js";

export class BaseRepository {
  /**
   * @param {Prisma.ModelName} model - Le modèle Prisma injecté (ex: prisma.user)
   */
  constructor(model) {
    this.model = model;
    this.prisma = prisma;
  }

  /**
   * Vérifie si un ID est un UUID valide
   * Remplace l'ancienne validation MongoDB ObjectId
   */
  static isValidId(id) {
    if (!id || typeof id !== "string") return false;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(id);
  }

  /**
   * Trouve une entité par son ID
   */
  findById(id, select) {
    if (!BaseRepository.isValidId(id)) return null;
    return this.model.findUnique({
      where: { id },
      select,
    });
  }

  /**
   * Trouve une seule entité par critères
   */
  findOne(where, options = {}) {
    return this.model.findUnique({
      where,
      ...options,
    });
  }

  /**
   * Trouve la première entité correspondante
   */
  findFirst(where, options = {}) {
    return this.model.findFirst({
      where,
      ...options,
    });
  }

  /**
   * Trouve plusieurs entités avec pagination
   */
  findMany(where = {}, options = {}) {
    const { page, limit, sort, ...rest } = options;

    if (!page || !limit) {
      return this.model.findMany({ where, ...rest });
    }

    const skip = (page - 1) * limit;
    const orderBy = sort || { createdAt: "desc" };

    return this.model.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      ...rest,
    });
  }

  /**
   * Crée une nouvelle entité
   */
  create(data, select) {
    return this.model.create({
      data,
      select,
    });
  }

  /**
   * Met à jour par ID
   */
  update(id, data, select) {
    return this.model.update({
      where: { id },
      data,
      select,
    });
  }

  /**
   * Met à jour plusieurs entités par critères
   */
  updateWhere(where, data) {
    return this.model.updateMany({
      where,
      data,
    });
  }

  /**
   * Supprime par ID
   */
  delete(id) {
    return this.model.delete({
      where: { id },
    });
  }

  /**
   * Supprime plusieurs entités par critères
   */
  deleteMany(where) {
    return this.model.deleteMany({
      where,
    });
  }

  /**
   * Compte le nombre d'entités
   */
  count(where = {}) {
    return this.model.count({ where });
  }

  /**
   * Vérifie l'existence d'une entité
   */
  async exists(where) {
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Agrégation Prisma
   */
  aggregate(args) {
    return this.model.aggregate(args);
  }

  /**
   * ⭐ NOUVEAU — Pagination avec métadonnées
   * Retourne { data, pagination } au lieu de juste les données
   */
  async findManyPaginated(where = {}, options = {}) {
    const { page = 1, limit = 10, sort, ...rest } = options;

    const skip = (page - 1) * limit;
    const orderBy = sort || { createdAt: "desc" };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        ...rest,
      }),
      this.model.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}