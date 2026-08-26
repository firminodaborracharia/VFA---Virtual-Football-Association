import type { Metadata } from 'next';

import { UsersManager } from '@/components/admin/users-manager';
import { listUsers } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Usuários' };

export default async function AdminUsersPage() {
  // Sequencial de propósito: a autorização precisa resolver antes de qualquer
  // consulta, senão a lista de usuários já teria sido buscada em paralelo.
  const session = await requireAdmin();
  const users = await listUsers();

  return <UsersManager users={users} currentUserId={session.user.id} />;
}
