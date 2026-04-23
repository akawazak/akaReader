import React, { memo } from 'react';

export const MangaDetailSkeleton = memo(() => (
  <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 20px 100px' }}>
    <div style={{ display: 'flex', gap: 28, marginBottom: 32, flexWrap: 'wrap' }}>
      <div className="anim-shimmer" style={{ width: 160, height: 240, borderRadius: 20, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 240, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="anim-shimmer" style={{ height: 34, borderRadius: 10, width: '75%' }} />
        <div className="anim-shimmer" style={{ height: 18, borderRadius: 8, width: '40%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="anim-shimmer" style={{ height: 24, width: 80, borderRadius: 20 }} />
          <div className="anim-shimmer" style={{ height: 24, width: 100, borderRadius: 20 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[70, 55, 85, 65, 75].map((w, i) => <div key={i} className="anim-shimmer" style={{ height: 22, width: w, borderRadius: 20 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div className="anim-shimmer" style={{ height: 48, width: 160, borderRadius: 12 }} />
          <div className="anim-shimmer" style={{ height: 48, width: 140, borderRadius: 12 }} />
        </div>
      </div>
    </div>
    <div className="anim-shimmer" style={{ height: 100, borderRadius: 16, marginBottom: 24 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="anim-shimmer" style={{ height: 60, borderRadius: 12 }} />)}
    </div>
  </div>
));
