/* ============================================================
   tools/bundle.js —— ESM 入口，调用 bundle.cjs
   ============================================================ */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./bundle.cjs');
