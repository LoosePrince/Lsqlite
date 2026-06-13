import { Input } from 'antd';

export function JsonEditor({
  value,
  onChange,
  rows = 8,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Input.TextArea
      className="json-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      spellCheck={false}
      placeholder={placeholder}
    />
  );
}