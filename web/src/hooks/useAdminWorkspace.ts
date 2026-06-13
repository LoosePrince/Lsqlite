import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const onErrorRef = useRef(onError);
  const errorsRef = useRef(errors);
  const databaseStatusRef = useRef<DatabaseStatus | 'all'>('active');
  const selectedDatabaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    onErrorRef.current = onError;
    errorsRef.current = errors;
  });

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

  useEffect(() => {
    databaseStatusRef.current = databaseStatus;
  }, [databaseStatus]);

  useEffect(() => {
    selectedDatabaseIdRef.current = selectedDatabase?.id || null;
  }, [selectedDatabase?.id]);

  const refreshDatabases = useCallback(async (nextStatus?: DatabaseStatus | 'all') => {
    const status = nextStatus ?? databaseStatusRef.current;
    setLoadingDatabases(true);
    try {
      const result = await api.listDatabases(status);
      setDatabases(result.databases);
      setSelectedDatabaseId((current) => {
        if (current && result.databases.some((database) => database.id === current)) return current;
        return result.databases[0]?.id || null;
      });
    } catch (error) {
      onErrorRef.current(error, errorsRef.current.loadDatabases);
    } finally {
      setLoadingDatabases(false);
    }
  }, []);

  const refreshTables = useCallback(async (databaseId?: string | null) => {
    const id = databaseId ?? selectedDatabaseIdRef.current;
    if (!id) {
      setTables([]);
      setSelectedTableName(null);
      return;
    }
    setLoadingTables(true);
    try {
      const result = await api.tables(id);
      setTables(result.tables);
      setSelectedTableName((current) => {
        if (current && result.tables.some((table) => table.name === current)) return current;
        return result.tables[0]?.name || null;
      });
    } catch (error) {
      setTables([]);
      setSelectedTableName(null);
      onErrorRef.current(error, errorsRef.current.loadTables);
    } finally {
      setLoadingTables(false);
    }
  }, []);

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
