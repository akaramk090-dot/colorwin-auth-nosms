import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.loadEnvFile(path.join(root,'.env'));
const {startServer}=await import('../apps/payment-api/src/index.js');
const {startCheckoutServer}=await import('../apps/checkout-portal/src/index.js');
const {startAdminServer}=await import('../apps/merchant-admin/src/index.js');
const services=[await startServer(),await startCheckoutServer(),await startAdminServer()];
console.log('Color Win YouPI local services ready: API 6100, checkout 7000, admin 6001.');
async function stop(){for(const service of services)await service.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
