// config/multerConfig.js
import multer from "multer";

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [".csv"];
  const name = file.originalname || "";
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only CSV files are allowed"));
};

export const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB limit (adjust if needed)
});
export default upload;
