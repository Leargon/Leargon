import React from 'react';
import type { EventDefinition } from '../../../../../api/generated/model/eventDefinition';

interface Props {
  definition?: EventDefinition | null;
  /** filled=true for end/throwing events, false for start/catching */
  filled?: boolean;
  size?: number;
}

/**
 * Renders the inner marker for a BPMN event node using proper SVG shapes.
 * Uses `currentColor` — parent must set `color` via sx or style.
 */
const EventIcon: React.FC<Props> = ({ definition, filled = false, size = 14 }) => {
  if (!definition || definition === 'NONE') return null;

  const stroke = 'currentColor';
  const fill = filled ? 'currentColor' : 'none';
  const inner = filled ? 'white' : 'currentColor';

  let content: React.ReactNode;
  switch (definition) {
    case 'TIMER':
      content = (
        <>
          <circle cx="10" cy="10" r="7.5" stroke={stroke} strokeWidth="1.5" fill={fill} />
          <line x1="10" y1="10" x2="10" y2="4" stroke={inner} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="10" x2="14" y2="10" stroke={inner} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="10" r="0.9" fill={inner} />
        </>
      );
      break;
    case 'MESSAGE':
      content = (
        <>
          <rect x="2" y="5" width="16" height="11" rx="0.5" stroke={stroke} strokeWidth="1.5" fill={fill} />
          <polyline
            points="2,6 10,11.5 18,6"
            stroke={inner}
            strokeWidth="1.5"
            fill="none"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    case 'SIGNAL':
      content = (
        <polygon points="10,3 18.5,17 1.5,17" stroke={stroke} strokeWidth="1.5" fill={fill} />
      );
      break;
    case 'CONDITIONAL':
      content = (
        <>
          <rect x="4" y="2" width="12" height="16" rx="1" stroke={stroke} strokeWidth="1.5" fill={fill} />
          <line x1="7" y1="7" x2="13" y2="7" stroke={inner} strokeWidth="1" />
          <line x1="7" y1="10.5" x2="13" y2="10.5" stroke={inner} strokeWidth="1" />
          <line x1="7" y1="14" x2="13" y2="14" stroke={inner} strokeWidth="1" />
        </>
      );
      break;
    case 'TERMINATE':
      // Filled circle — BPMN terminate end event marker
      content = (
        <circle cx="10" cy="10" r="6" stroke={stroke} strokeWidth="1.5" fill="currentColor" />
      );
      break;
    default:
      return null;
  }

  return (
    <svg viewBox="0 0 20 20" width={size} height={size} style={{ display: 'block' }}>
      {content}
    </svg>
  );
};

export default EventIcon;
