import { Layout } from 'antd';
import type { PropsWithChildren, ReactNode } from 'react';

export function DesktopShell({ explorer, topbar, children }: PropsWithChildren<{ explorer: ReactNode; topbar: ReactNode }>) {
  return (
    <Layout className="admin-shell desktop-shell">
      {topbar}
      <Layout className="admin-body">
        {explorer}
        <main className="workspace-shell">{children}</main>
      </Layout>
    </Layout>
  );
}