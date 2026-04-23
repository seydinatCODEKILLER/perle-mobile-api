import cloudinary from "../../config/cloudinary.js";

class MediaUploader {
  constructor() {
    this.uploadResults = new Map();
  }

  /**
   * Upload un fichier vers Cloudinary
   * @param {Object} file - Objet fichier multer (contenant buffer)
   * @param {string} folder - Dossier de destination
   * @param {string} prefix - Préfixe pour le public_id
   */
  async upload(file, folder = "organize/members", prefix = "avatar") {
    if (!file || !file.buffer) return null;

    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: `${prefix}_${Date.now()}`,
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.end(file.buffer);
      });

      this.uploadResults.set(prefix, {
        public_id: result.public_id,
        url: result.secure_url,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  }

  async rollback(prefix) {
    const uploadInfo = this.uploadResults.get(prefix);
    if (!uploadInfo) return;

    try {
      await cloudinary.uploader.destroy(uploadInfo.public_id, { resource_type: "image" });
      this.uploadResults.delete(prefix);
      console.log(`Rollback successful - deleted: ${uploadInfo.public_id}`);
    } catch (error) {
      console.error("Rollback failed:", error);
    }
  }

  async deleteByUrl(url) {
    if (!url) return;

    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
      const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));

      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        console.log(`Deleted media: ${publicId}`);
      }
    } catch (error) {
      console.error("Delete by URL failed:", error);
    }
  }
}

export default MediaUploader;