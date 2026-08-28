import Link from 'next/link';

import type { Dictionary } from '@/lib/i18n/dictionaries';
import { NAV_ITEMS } from '@/lib/nav';
import { DEFAULT_CREST } from '@/lib/utils';

export function SiteFooter({
  siteName,
  fullName,
  discordUrl,
  dict,
}: {
  siteName: string;
  fullName: string;
  discordUrl: string | null;
  dict: Dictionary;
}) {
  const year = new Date().getFullYear();
  const links = NAV_ITEMS.filter((item) => !item.adminOnly);

  return (
    <footer className="mt-16 border-t border-line bg-bg-elevated/60">
      <div className="container-vfa py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEFAULT_CREST} alt="" className="size-11 object-contain" />
              <span className="display-vfa text-lg">{siteName}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{fullName}</p>
            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent/50 hover:text-accent"
              >
                {dict.footer.discord}
              </a>
            ) : null}
          </div>

          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted transition-colors hover:text-accent"
              >
                {dict.nav[item.key]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {fullName}. {dict.footer.amateur}
          </p>
          <p>
            {dict.footer.notAffiliated}
          </p>
        </div>
      </div>
    </footer>
  );
}
