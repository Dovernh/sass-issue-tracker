import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from './openapi.js';

// Writes the OpenAPI spec to backend/openapi.json for the frontend generator.
const out = fileURLToPath(new URL('../openapi.json', import.meta.url));
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log(`Wrote ${out}`);
