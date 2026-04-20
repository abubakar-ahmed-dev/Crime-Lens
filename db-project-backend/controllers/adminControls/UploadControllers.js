// controllers/adminControls/UploadController.js
import db from "../../models/index.js";
import { parseCSVBuffer } from "../../utils/fileParser.js";
import {
  preloadReferenceSets,
  fetchExistingKeysFromDB,
  prepareInsertPayloads,
  bulkInsertWithChunking,
} from "../../utils/bulkInsertHelper.js";
import { parse } from "date-fns";

const Crime = db.Crime;
const UploadLog = db.UploadLog;

const REQUIRED_FIELDS = ["title", "crimeTypeId", "incidentDate", "reportedAt", "latitude", "longitude"];

/**
 * Excel-safe flexible date parser
 */
function parseFlexibleDate(str) {
  if (!str) return null;

  const formats = [
    "M/d/yyyy",
    "M/d/yyyy H:mm",
    "M/d/yyyy HH:mm",
    "MM/dd/yyyy",
    "MM/dd/yyyy H:mm",
    "MM/dd/yyyy HH:mm",
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "yyyy-MM-dd H:mm",
    "yyyy/MM/dd H:mm",
    "yyyy-MM-dd HH:mm:ss",
    "M/d/yyyy h:mm a",
  ];

  for (const f of formats) {
    try {
      const parsed = parse(str, f, new Date());
      if (!isNaN(parsed.getTime())) return parsed;
    } catch {}
  }

  const auto = new Date(str);
  return !isNaN(auto.getTime()) ? auto : null;
}

/**
 * uploadCrimesCSV - main endpoint controller
 */
export const uploadCrimesCSV = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: "CSV file missing" });
    }

    const originalname = req.file.originalname || "upload.csv";

    // 1) Parse CSV buffer
    const { rows: rawRows, parseInvalids, total } = await parseCSVBuffer(req.file.buffer, {
      requiredFields: REQUIRED_FIELDS,
    });

    let invalid = parseInvalids.length;
    let duplicates = 0;
    let inserted = 0;

    if (!rawRows.length) {
      await UploadLog.create({ filename: originalname, status: "completed", totalRecords: total, recordsUploaded: 0 });
      return res.status(200).json({
        success: true,
        message: "No valid rows found in CSV",
        stats: { total, inserted: 0, duplicates: 0, invalid },
        parseInvalids,
      });
    }

    // 2) Preload crime types & zones for FK validation
    const { validCrimeTypes, validZones } = await preloadReferenceSets(db);

    // 3) Normalize and validate each row
    const cleanedRows = [];
    for (const r of rawRows) {
      const row = {
        title: r.title?.trim(),
        description: (r.description ?? "").trim() || null,
        crimeTypeId: r.crimeTypeId ? String(r.crimeTypeId).trim() : null,
        incidentDate: r.incidentDate?.trim(),
        reportedAt: r.reportedAt?.trim() || null,
        status: r.status?.trim() || "pending",
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address?.trim() || null,
        zoneId: r.zoneId ? String(r.zoneId).trim() : null,
      };

      // Required-field check
      const missing = REQUIRED_FIELDS.filter((f) => {
        const value = row[f];
        return value === undefined || value === null || value.toString().trim() === "";
      });

      if (missing.length) {
        invalid++;
        continue;
      }

      // Numeric check for latitude & longitude
      const lat = parseFloat(row.latitude);
      const lon = parseFloat(row.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        invalid++;
        continue;
      }

      // Excel-safe date parsing
      const incidentDateObj = parseFlexibleDate(row.incidentDate);
      if (!incidentDateObj) {
        invalid++;
        continue;
      }

      const reportedAtObj = row.reportedAt ? parseFlexibleDate(row.reportedAt) : incidentDateObj;

      // Status validation
      const validStatuses = ["pending", "approved", "rejected"];
      if (!validStatuses.includes(row.status)) row.status = "pending";

      // Foreign key checks
      if (validCrimeTypes.size && !validCrimeTypes.has(String(row.crimeTypeId))) {
        invalid++;
        continue;
      }
      if (validZones.size && row.zoneId && !validZones.has(String(row.zoneId))) {
        invalid++;
        continue;
      }

      cleanedRows.push({ ...row, incidentDateObj, reportedAtObj, latitude: lat, longitude: lon });
    }

    if (!cleanedRows.length) {
      await UploadLog.create({ filename: originalname, status: "completed", totalRecords: total, recordsUploaded: 0 });
      return res.status(200).json({
        success: true,
        message: "No valid rows after validation",
        stats: { total, inserted: 0, duplicates: 0, invalid },
      });
    }

    // 4) Detect duplicates & 5) Prepare insert payloads
    const existingKeys = await fetchExistingKeysFromDB(db, cleanedRows, Crime);
    const { toInsert, duplicates: dupCount } = prepareInsertPayloads(cleanedRows, existingKeys);
    duplicates += dupCount;

    // 6) Bulk insert
    if (toInsert.length) {
      try {
        inserted = await bulkInsertWithChunking(Crime, toInsert, db, 100);
      } catch (e) {
        await UploadLog.create({ filename: originalname, status: "failed", totalRecords: total, recordsUploaded: inserted });
        return res.status(500).json({
          success: false,
          message: "Fatal error during DB insert",
          error: e.message,
          stats: { total, inserted, duplicates, invalid },
        });
      }
    }

    // 7) Log upload
    await UploadLog.create({ filename: originalname, status: "completed", totalRecords: total, recordsUploaded: inserted });

    // 8) Response
    return res.status(200).json({
      success: true,
      message: "Upload completed",
      stats: { total, inserted, duplicates, invalid },
    });

  } catch (err) {
    try {
      const originalname = req.file?.originalname || "upload.csv";
      await UploadLog.create({ filename: originalname, status: "failed", totalRecords: 0, recordsUploaded: 0 });
    } catch {}
    return next(err);
  }
};
