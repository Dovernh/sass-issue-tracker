import { runMigrations, db } from './db/index.js';
import { memberships, users } from './db/schema.js';
import { hashPassword } from './hash.js';
import { newUserId } from './ids.js';
import { permissionsForRole } from './permissions.js';
import { findUserByEmail } from './auth.repo.js';
import { createOrgWithAdmin } from './platform.repo.js';

/**
 * Dev seed for the SaaS tenancy model. Creates a platform owner (no org), two
 * sample orgs each with their own admin, and one member who belongs to BOTH
 * orgs so the navbar org switcher is exercisable. All passwords are `password123`
 * — DEV ONLY. Idempotent: re-running is a no-op once the owner exists.
 *
 *   npm run db:seed
 */

const PW = 'password123';

async function seed(): Promise<void> {
  await runMigrations();

  if (await findUserByEmail('owner@local.dev')) {
    console.log('Already seeded (owner@local.dev exists) — nothing to do.');
    return;
  }

  // Platform owner: control plane only, no org membership.
  await db.insert(users).values({
    id: newUserId(),
    email: 'owner@local.dev',
    passwordHash: await hashPassword(PW),
    name: 'Platform Owner',
    platformRole: 'owner',
  });

  // Two orgs, each provisioned with its own first admin (+ default options).
  const acme = await createOrgWithAdmin({
    orgName: 'Acme Inc',
    adminEmail: 'admin@acme.dev',
    adminName: 'Acme Admin',
    adminPasswordHash: await hashPassword(PW),
  });
  const globex = await createOrgWithAdmin({
    orgName: 'Globex',
    adminEmail: 'admin@globex.dev',
    adminName: 'Globex Admin',
    adminPasswordHash: await hashPassword(PW),
  });

  // A member who belongs to both orgs — logs in to see the org switcher.
  const memberId = newUserId();
  await db.insert(users).values({
    id: memberId,
    email: 'member@local.dev',
    passwordHash: await hashPassword(PW),
    name: 'Multi-Org Member',
  });
  for (const orgId of [acme.id, globex.id]) {
    await db.insert(memberships).values({
      userId: memberId,
      orgId,
      role: 'member',
      permissions: permissionsForRole('member'),
    });
  }

  console.log('Seeded SaaS tenancy data (all passwords: password123):');
  console.log('  platform owner : owner@local.dev   (no org; /api/platform only)');
  console.log('  Acme admin     : admin@acme.dev');
  console.log('  Globex admin   : admin@globex.dev');
  console.log('  multi-org member: member@local.dev  (Acme + Globex → org switcher)');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
