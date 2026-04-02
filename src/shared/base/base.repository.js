import { prisma } from "../../config/database.js";

export class BaseRepository {
  /**
   * @param {Prisma.ModelName} model - Le modèle Prisma injecté (ex: prisma.member)
   */
  constructor(model) {
    this.model = model;
    // On expose le client prisma pour les transactions dans les repositories enfants
    this.prisma = prisma;
  }

  /**
   * Vérifie si un ID est un ObjectId MongoDB valide
   * (Évite les crashes Prisma sur les IDs malformés)
   */
  static isValidId(id) {
    return /^[a-fA-F0-9]{24}$/.test(id);
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
   * Trouve la première entité correspondante (utile pour les index non uniques)
   */
  findFirst(where, options = {}) {
    return this.model.findFirst({
      where,
      ...options,
    });
  }

  /**
   * Trouve plusieurs entités avec support de la pagination standard
   */
  findMany(where = {}, options = {}) {
    const { page, limit, sort, ...rest } = options;

    // Si pas de pagination, on retourne tout (avec les options classiques)
    if (!page || !limit) {
      return this.model.findMany({ where, ...rest });
    }

    // Construction de la pagination
    const skip = (page - 1) * limit;
    const orderBy = sort || { createdAt: "desc" };

    return this.model.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      ...rest, // Inclut select, include, etc.
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
   * (Attention: Pour les données financières, préférez souvent un soft delete)
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
   * Agrégation (ex: Somme, Moyenne)
   * Utile pour les stats financières (SUM amount)
   */
  aggregate(args) {
    return this.model.aggregate(args);
  }
}