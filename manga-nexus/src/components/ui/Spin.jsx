import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

export const Spin = memo(({ size = 24 }) => (
  <Loader2 size={size} className="anim-spin" style={{ color: 'var(--accent)' }} />
));
