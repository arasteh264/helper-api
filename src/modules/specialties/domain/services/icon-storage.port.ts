export interface StoredIcon {
  url: string;
  publicId: string;
}

export interface IIconStorage {
  uploadIcon(file: Express.Multer.File, folder: string): Promise<StoredIcon>;
  deleteIcon(publicId: string): Promise<void>;
}
