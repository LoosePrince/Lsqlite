import { Button, Tabs } from 'antd';
import { Popup, NavBar, List as MobileList, Tabs as MobileTabs } from 'antd-mobile';
import { AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { DatabaseStatus } from '../api.js';
import { DatabaseExplorer } from '../components/DatabaseExplorer.js';
import { EmptyWorkbench } from '../components/EmptyWorkbench.js';
import { ApiExamplesTab } from '../features/ApiExamplesTab.js';
import { AuditTab } from '../features/AuditTab.js';
import { BrowseTab } from '../features/BrowseTab.js';
import { OperationsTab } from '../features/OperationsTab.js';
import { OverviewTab } from '../features/OverviewTab.js';
import { SqlConsoleTab } from '../features/SqlConsoleTab.js';
import { StructureTab } from '../features/StructureTab.js';
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.js';
import { AdminTopbar } from '../layouts/AdminTopbar.js';
import { OperationDrawer } from '../layouts/OperationDrawer.js';
import type { AdminUser, DrawerMode, NoticeApi, WorkspaceTab } from '../types.js';
import { api } from '../api.js';
import { StatusTag } from '../components/StatusTag.js';

const tabItems: Array<{ key: WorkspaceTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'structure', label: 'Structure' },
  { key: 'browse', label: 'Browse' },
  { key: 'sql', label: 'SQL' },
  { key: 'operations', label: 'Operations' },
  { key: 'api', label: 'API Examples' },
  { key: 'audit', label: 'Audit' }
];

export function AdminDashboard({ admin, setAdmin, notice }: { admin: AdminUser; setAdmin: (admin: AdminUser | null) => void; notice: NoticeApi }) {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [rowRefreshSignal, setRowRefreshSignal] = useState(0);
  const workspace = useAdminWorkspace({ onError: notice.error });

  const currentTab = useMemo(() => {
    if (!workspace.selectedDatabase) return null;
    if (workspace.activeTab === 'overview') {
      return (
        <OverviewTab
          database={workspace.selectedDatabase}
          tables={workspace.tables}
          onCreateTable={() => setDrawerMode('create-table')}
          onCreateIndex={() => setDrawerMode('create-index')}
          onSwitchTab={workspace.setActiveTab}
        />
      );
    }
    if (workspace.activeTab === 'structure') {
      return (
        <StructureTab
          database={workspace.selectedDatabase}
          tables={workspace.tables}
          selectedTable={workspace.selectedTable}
          selectedTableName={workspace.selectedTableName}
          notice={notice}
          onSelectTable={(name) => workspace.selectTable(name, 'structure')}
          onRefreshTables={() => workspace.refreshTables()}
          onOpenCreateTable={() => setDrawerMode('create-table')}
          onOpenAddColumn={() => setDrawerMode('add-column')}
          onOpenCreateIndex={() => setDrawerMode('create-index')}
        />
      );
    }
    if (workspace.activeTab === 'browse') {
      return (
        <BrowseTab
          database={workspace.selectedDatabase}
          tables={workspace.tables}
          selectedTable={workspace.selectedTable}
          selectedTableName={workspace.selectedTableName}
          notice={notice}
          onSelectTable={(name) => workspace.selectTable(name, 'browse')}
          onOpenInsertRow={() => setDrawerMode('insert-row')}
          refreshSignal={rowRefreshSignal}
        />
      );
    }
    if (workspace.activeTab === 'sql') return <SqlConsoleTab database={workspace.selectedDatabase} table={workspace.selectedTable} notice={notice} />;
    if (workspace.activeTab === 'operations') {
      return <OperationsTab database={workspace.selectedDatabase} notice={notice} onRefreshDatabases={() => workspace.refreshDatabases()} />;
    }
    if (workspace.activeTab === 'api') return <ApiExamplesTab database={workspace.selectedDatabase} table={workspace.selectedTable} notice={notice} />;
    return <AuditTab database={workspace.selectedDatabase} notice={notice} />;
  }, [notice, rowRefreshSignal, workspace]);

  async function logout() {
    await api.logout();
    setAdmin(null);
  }

  async function refreshAll() {
    await workspace.refreshDatabases();
    await workspace.refreshTables();
    setRowRefreshSignal((value) => value + 1);
  }

  const explorer = (
    <DatabaseExplorer
      databases={workspace.filteredDatabases}
      tables={workspace.tables}
      selectedDatabaseId={workspace.selectedDatabase?.id || null}
      selectedTableName={workspace.selectedTableName}
      status={workspace.databaseStatus}
      search={workspace.databaseSearch}
      loadingDatabases={workspace.loadingDatabases}
      loadingTables={workspace.loadingTables}
      onStatusChange={(value: DatabaseStatus | 'all') => workspace.setDatabaseStatus(value)}
      onSearchChange={workspace.setDatabaseSearch}
      onSelectDatabase={(id) => {
        workspace.selectDatabase(id);
        setMobileExplorerOpen(false);
      }}
      onSelectTable={(name) => {
        workspace.selectTable(name, 'structure');
        setMobileExplorerOpen(false);
      }}
      onCreateDatabase={() => setDrawerMode('create-database')}
      onRefresh={() => workspace.refreshDatabases()}
    />
  );

  return (
    <main className="admin-shell-pro">
      <AdminTopbar
        admin={admin}
        database={workspace.selectedDatabase}
        table={workspace.selectedTable}
        onRefresh={refreshAll}
        onLogout={logout}
        onOpenMobileExplorer={() => setMobileExplorerOpen(true)}
      />

      <section className="admin-body">
        <div className="desktop-explorer">{explorer}</div>
        <section className="workspace-shell">
          {workspace.selectedDatabase ? (
            <>
              <Tabs
                className="workspace-tabs desktop-tabs"
                activeKey={workspace.activeTab}
                onChange={(key) => workspace.setActiveTab(key as WorkspaceTab)}
                items={tabItems}
              />
              <NavBar className="mobile-nav" back={null} right={<Button size="small" onClick={() => setMobileExplorerOpen(true)}>资源</Button>}>
                {workspace.selectedDatabase.name}
              </NavBar>
              <MobileTabs
                className="mobile-tabs"
                activeKey={workspace.activeTab}
                onChange={(key) => workspace.setActiveTab(key as WorkspaceTab)}
              >
                {tabItems.map((item) => (
                  <MobileTabs.Tab key={item.key} title={item.label.replace(' Examples', '')} />
                ))}
              </MobileTabs>
              <AnimatePresence mode="wait">{currentTab}</AnimatePresence>
            </>
          ) : (
            <EmptyWorkbench />
          )}
        </section>
      </section>

      <OperationDrawer
        mode={drawerMode}
        database={workspace.selectedDatabase}
        table={workspace.selectedTable}
        notice={notice}
        onClose={() => setDrawerMode(null)}
        onDatabaseCreated={workspace.selectDatabase}
        onRefreshDatabases={() => workspace.refreshDatabases()}
        onRefreshTables={() => workspace.refreshTables()}
        onRowsChanged={() => setRowRefreshSignal((value) => value + 1)}
      />

      <Popup visible={mobileExplorerOpen} onMaskClick={() => setMobileExplorerOpen(false)} position="left" bodyClassName="mobile-resource-popup">
        <div className="mobile-resource-head">
          <strong>数据库资源</strong>
          <Button size="small" onClick={() => setDrawerMode('create-database')}>新建</Button>
        </div>
        <MobileList>
          {workspace.filteredDatabases.map((database) => (
            <MobileList.Item
              key={database.id}
              extra={<StatusTag status={database.status} />}
              onClick={() => {
                workspace.selectDatabase(database.id);
                setMobileExplorerOpen(false);
              }}
            >
              {database.name}
            </MobileList.Item>
          ))}
        </MobileList>
        {workspace.tables.length > 0 ? (
          <MobileList header="当前数据库表">
            {workspace.tables.map((table) => (
              <MobileList.Item
                key={table.name}
                description={`${table.type} · ${table.rowCount ?? '-'} rows`}
                onClick={() => {
                  workspace.selectTable(table.name, 'structure');
                  setMobileExplorerOpen(false);
                }}
              >
                {table.name}
              </MobileList.Item>
            ))}
          </MobileList>
        ) : null}
      </Popup>
    </main>
  );
}