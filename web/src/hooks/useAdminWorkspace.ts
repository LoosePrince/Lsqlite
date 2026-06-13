import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type DatabaseStatus, type ManagedDatabase, type TableInfo } from '../api.js';
import type { WorkspaceTab } from '../types.js';

type UseAdminWorkspaceInput = {
  onError: (error: unknown, action: string) => void;
  errors: {
    loadDatabases: string;
    loadTables: string;
  };
};

export function useAdminWorkspace({ onError, errors }: UseAdminWorkspaceInput) {
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | 'all'>('active');
  const [databaseSearch, setDatabaseSearch] = useState('');
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const selectedDatabase = useMemo(
    () => databases.find((database) => database.id === selectedDatabaseId) || databases[0] || null,
    [databases, selectedDatabaseId]
  );

  const selectedTable = useMemo(
    () => tables.find((table) => table.name === selectedTableName) || tables[0] || null,
    [tables, selectedTableName]
  );

  const filteredDatabases = useMemo(() => {
    const keyword = databaseSearch.trim().toLowerCase();
    if (!keyword) return databases;
    return databases.filter((database) => {
      const text = `${database.name} ${database.filename} ${database.note || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [databases, databaseSearch]);

  const refreshDatabases = useCallback(
    async (nextStatus = databaseStatus) => {
      setLoadingDatabases(true);
      try {
        const result = await api.listDatabases(nextStatus);
        setDatabases(result.databases);
        setSelectedDatabaseId((current) => {
          if (current && result.databases.some((database) => database.id === current)) return current;
          return result.databases[0]?.id || null;
        });
      } catch (error) {
        onError(error, errors.loadDatabases);
      } finally {
        setLoadingDatabases(false);
      }
    },
    [databaseStatus, errors.loadDatabases, onError]
  );

  const refreshTables = useCallback(
    async (databaseId = selectedDatabase?.id || null) => {
      if (!databaseId) {
        setTables([]);
        setSelectedTableName(null);
        return;
      }
      setLoadingTables(true);
      try {
        const result = await api.tables(databaseId);
        setTables(result.tables);
        setSelectedTableName((current) => {
          if (current && result.tables.some((table) => table.name === current)) return current;
          return result.tables[0]?.name || null;
        });
      } catch (error) {
        setTables([]);
        setSelectedTableName(null);
        onError(error, errors.loadTables);
      } finally {
        setLoadingTables(false);
      }
    },
    [errors.loadTables, onError, selectedDatabase?.id]
  );

  const selectDatabase = useCallback((databaseId: string) => {
    setSelectedDatabaseId(databaseId);
    setSelectedTableName(null);
    setActiveTab('overview');
  }, []);

  const selectTable = useCallback((tableName: string, nextTab: WorkspaceTab = 'structure') => {
    setSelectedTableName(tableName);
    setActiveTab(nextTab);
  }, []);

  useEffect(() => {
    refreshDatabases(databaseStatus).catch(() => undefined);
  }, [databaseStatus, refreshDatabases]);

  useEffect(() => {
    refreshTables(selectedDatabase?.id || null).catch(() => undefined);
  }, [selectedDatabase?.id, refreshTables]);

  return {
    databases,
    filteredDatabases,
    databaseStatus,
    setDatabaseStatus,
    databaseSearch,
    setDatabaseSearch,
    selectedDatabase,
    selectedDatabaseId,
    selectDatabase,
    tables,
    selectedTable,
    selectedTableName,
    selectTable,
    setSelectedTableName,
    activeTab,
    setActiveTab,
    loadingDatabases,
    loadingTables,
    refreshDatabases,
    refreshTables
  };
}
