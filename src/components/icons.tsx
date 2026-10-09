import { Box, Database, Monitor, Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6.5 18.5a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.3A4.5 4.5 0 0 1 17.5 18.5h-11Z"
          fill="#5b8cff"
        />
      </svg>
    </span>
  );
}

export const TYPE_ICON = {
  vm: <Monitor size={16} aria-hidden="true" />,
  ct: <Box size={16} aria-hidden="true" />,
  s3: <Database size={16} aria-hidden="true" />,
  ai: <Sparkles size={16} aria-hidden="true" />,
};
