import { Box, Database, Monitor, Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <span className="logo">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M5 17V7h6a3 3 0 0 1 0 6H5M14 17l5-10" />
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
