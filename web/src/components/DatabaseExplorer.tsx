import { Button, Empty, Input, Radio, Space, Spin, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import type { DatabaseStatus, ManagedDatabase } from '../api.js';
import { useI18n } from '../i18n/context.js';
import { StatusTag } from './StatusTag.js';
import { databaseSubtitle } from '../utils/format.js';

export function DatabaseExplorer({
  databases,
  selectedDatabaseId,
  status,
  search,
  loadingDatabases,
  onStatusChange,
  onSearchChange,
  onSelectDatabase,
  onCreateDatabase,
  onRefresh
}: {
  databases: ManagedDatabase[];
  selectedDatabaseId: string | null;
  status: DatabaseStatus | 'all';
  search: string;
  loadingDatabases: boolean;
  onStatusChange: (status: DatabaseStatus | 'all') => void;
  onSearchChange: (value: string) => void;
  onSelectDatabase: (id: string) => void;
  onCreateDatabase: () => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();

  return (
    <aside className="db-explorer">
      <div className="explorer-head">
        <div>
          <Typography.Text className="eyebrow">{t('explorer.eyebrow')}</Typography.Text>
          <Typography.Title level={4}>{t('explorer.title')}</Typography.Title>
        </div>
        <Button type="primary" onClick={onCreateDatabase}>{t('common.new')}</Button>
      </div>

      <Space.Compact className="explorer-search">
        <Input.Search placeholder={t('explorer.searchPlaceholder')} value={search} onChange={(event) => onSearchChange(event.target.value)} allowClear />
        <Button onClick={onRefresh}>{t('common.refresh')}</Button>
      </Space.Compact>

      <Radio.Group
        className="status-filter"
        size="small"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as DatabaseStatus | 'all')}
        optionType="button"
        buttonStyle="solid"
        options={[
          { label: t('common.active'), value: 'active' },
          { label: t('common.disabled'), value: 'disabled' },
          { label: t('common.deleted'), value: 'deleted' },
          { label: t('common.all'), value: 'all' }
        ]}
      />

      <div className="explorer-list">
        {loadingDatabases ? <Spin /> : null}
        {!loadingDatabases && databases.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('explorer.empty')} /> : null}
        <AnimatePresence initial={false}>
          {databases.map((database) => {
            const selected = selectedDatabaseId === database.id;
            return (
              <motion.div
                key={database.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`explorer-db ${selected ? 'is-active' : ''}`}
              >
                <button className="explorer-db-button" type="button" onClick={() => onSelectDatabase(database.id)}>
                  <span className="db-name">{database.name}</span>
                  <StatusTag status={database.status} />
                  <span className="db-subtitle">{databaseSubtitle(database)}</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}
