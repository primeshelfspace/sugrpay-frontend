import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PRODUCT_NAMES, coversAllBrands } from '@platform/platform-contracts';
import { getCurrentUser, listBrands, listUsers } from '@/accounts/lib/api';
import { can } from '@/accounts/lib/permissions';
import { Notice, roleLabel } from '@/accounts/components/notice';
import {
  Badge,
  Card,
  PageHeader,
  buttonClass,
  inputClass,
} from '@/accounts/components/page-header';
import { inviteAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Everyone in the company and their Sugrpay role (which is also their
 * account role).
 */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!can(user, 'USERS', 'READ')) redirect('/accounts');
  const [{ data: users }, brands, params] = await Promise.all([
    listUsers(),
    listBrands(),
    searchParams,
  ]);
  const canInvite = can(user, 'USERS', 'WRITE');

  return (
    <>
      <PageHeader
        title="Team"
        description="People in your company and the products they can use."
      />
      <Notice saved={params.saved} error={params.error} />

      {canInvite && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-base font-bold text-[#0F172A]">Invite someone</h2>
          <form action={inviteAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className={inputClass} />
              <input
                name="email"
                type="email"
                required
                placeholder="Email"
                className={inputClass}
              />
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-[#0F172A]">
                  {PRODUCT_NAMES.INVOICING} role
                </span>
                <select
                  name="role"
                  className={inputClass}
                  defaultValue={user.assignableRoles.at(-1)}
                >
                  {user.assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {brands.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-[#0F172A]">
                  Brands{' '}
                  <span className="font-normal text-slate-500">
                    (not needed for Merchant Owner / Admin)
                  </span>
                </legend>
                <div className="flex flex-wrap gap-3">
                  {brands.map((brand) => (
                    <label
                      key={brand.id}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input type="checkbox" name="brandIds" value={brand.id} />
                      {brand.displayName}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <button type="submit" className={buttonClass}>
              Send invitation
            </button>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 font-semibold">{PRODUCT_NAMES.INVOICING}</th>
              <th className="px-4 py-3 font-semibold">Brands</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-3">
                  <Link
                    href={`/accounts/team/${member.id}`}
                    className="font-semibold text-[#0F172A] hover:underline"
                  >
                    {member.name}
                  </Link>
                  <p className="text-slate-500">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  {member.productRoles.INVOICING ? roleLabel(member.productRoles.INVOICING) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {coversAllBrands(member.role) ? 'All' : member.assignedBrandIds.length}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      member.status === 'ACTIVE'
                        ? 'green'
                        : member.status === 'INVITED'
                          ? 'amber'
                          : 'red'
                    }
                  >
                    {roleLabel(member.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
