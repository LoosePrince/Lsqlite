import { Button, Typography } from 'antd';

export function CodeBlock({ title, value, onCopy }: { title?: string; value: string; onCopy?: () => void }) {
  return (
    <div className="code-panel">
      {title || onCopy ? (
        <div className="code-panel-head">
          <Typography.Text strong>{title}</Typography.Text>
          {onCopy ? <Button size="small" onClick={onCopy}>复制</Button> : null}
        </div>
      ) : null}
      <pre>{value}</pre>
    </div>
  );
}