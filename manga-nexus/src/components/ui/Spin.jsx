import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

const SPIN_SIZES = {
  sm: 14,
  md: 24,
  lg: 40,
  xl: 48,
};

export const Spin = memo(({ size = 24, color = 'var(--accent)', style }) => {
  const resolvedSize = typeof size === 'number' ? size : (SPIN_SIZES[size] || SPIN_SIZES.md);
  return (
    <Loader2
      size={resolvedSize}
      className="anim-spin"
      style={{ width: resolvedSize, height: resolvedSize, flexShrink: 0, color, ...style }}
    />
  );
});
