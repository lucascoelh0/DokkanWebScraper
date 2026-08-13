"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_context_1 = require("./data-download-context");
const data_download_dd8_1 = require("./data-download-dd8");
const { root, dd2 } = (0, data_download_context_1.loadDdContext)(), dd6Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-data-download-captures/dd6/data-download-dd6-shadow-parity.json"), "utf8"), dd7Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-data-download-captures/dd7/data-download-dd7-architecture.json"), "utf8"), dataset = (0, data_download_dd8_1.buildDd8)(dd2.generatedAt, dd6Text, dd7Text), validation = (0, data_download_dd8_1.validateDd8)(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`, out = (0, path_1.resolve)(root, "data/database-data-download-captures/dd8");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd8-readiness.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd8-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "data-download-dd8-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, fileName: "data-download-dd8-readiness.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=data-download-dd8-run.js.map