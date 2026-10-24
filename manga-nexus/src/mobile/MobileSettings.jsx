import React, { memo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { storage } from '../utils/helpers';
import { THEMES } from '../constants';

// Phone settings: the same setting keys the desktop SettingsPage writes, minus the
// desktop-only ones (Windows service, Java/Suwayomi runtime, tray, Discord, repos).

const READER_MODES = [['scroll', 'Scroll'], ['paged', 'Paged'], ['webtoon', 'Strip']];
const FIT_MODES = [['height', 'Height'], ['width', 'Width'], ['original', 'Original']];
const UPDATE_INTERVALS = [
  [0, 'Manual'], [15 * 60 * 1000, '15 min'], [30 * 60 * 1000, '30 min'],
  [60 * 60 * 1000, '1 hour'], [3 * 60 * 60 * 1000, '3 hours'], [6 * 60 * 60 * 1000, '6 hours'],
];
const ACCENTS = ['#f97316', '#ff5e00', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#eab308'];

const Segs = ({ value, options, onChange, grid }) => (
  <div className={`m-segs ${grid ? 'grid' : ''}`}>
    {options.map(([id, label]) => (
      <button key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
    ))}
  </div>
);

const Switch = ({ on, onChange, label }) => (
  <button className={`m-switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>
);

const Row = ({ title, sub, children, stack }) => (
  <div className={`m-set-row ${stack ? 'stack' : ''}`}>
    <div className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</div>
    {children}
  </div>
);

const MobileSettings = memo(({ onSheet }) => {
  const { settings, updateSetting, categories, addCategory, removeCategory, clearHistory } = useData();
  const [newCategory, setNewCategory] = useState('');
  const accent = settings?.accentColor || '#f97316';
  const interval = Number(settings?.chapterUpdateInterval ?? 60 * 60 * 1000);

  const confirmClear = (label, key) => onSheet({
    title: `Clear ${label.toLowerCase()}? This can't be undone.`,
    items: [{
      label: `Clear ${label.toLowerCase()}`, icon: Trash2,
      action: () => {
        if (key === 'history') clearHistory();
        else { storage.set(key, {}); window.location.reload(); }
      },
    }],
  });

  return (
    <div className="m-settings">
      <div className="m-set-sec">Reader</div>
      <div className="m-set-card">
        <Row title="Default mode" stack><Segs value={settings?.readerMode || 'scroll'} options={READER_MODES} onChange={v => updateSetting('readerMode', v)} /></Row>
        <Row title="Fit pages to" sub="Paged mode" stack><Segs value={settings?.fitMode || 'height'} options={FIT_MODES} onChange={v => updateSetting('fitMode', v)} /></Row>
        <Row title="Brightness" sub={`${settings?.brightness || 100}%`} stack>
          <input type="range" min={40} max={160} value={settings?.brightness || 100} onChange={e => updateSetting('brightness', Number(e.target.value))} className="m-range" />
        </Row>
        <Row title="Reader background" stack>
          <div className="m-swatches">
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} aria-label={t.label} className={(settings?.readerTheme || 'dark') === key ? 'on' : ''} style={{ background: t.bg }} onClick={() => updateSetting('readerTheme', key)}>
                <i style={{ background: t.accent }} />
              </button>
            ))}
          </div>
        </Row>
      </div>

      <div className="m-set-sec">Library updates</div>
      <div className="m-set-card">
        <Row title="Check for new chapters" stack><Segs grid value={interval} options={UPDATE_INTERVALS} onChange={v => updateSetting('chapterUpdateInterval', v)} /></Row>
        <Row title="Auto-download new chapters" sub="Queue new chapters for offline reading"><Switch label="Auto-download new chapters" on={!!settings?.autoDownloadNewChapters} onChange={v => updateSetting('autoDownloadNewChapters', v)} /></Row>
      </div>

      <div className="m-set-sec">Downloads</div>
      <div className="m-set-card">
        <Row title="Delete chapters after reading" sub="Frees space once a downloaded chapter is read"><Switch label="Delete chapters after reading" on={!!settings?.autoDeleteRead} onChange={v => updateSetting('autoDeleteRead', v)} /></Row>
      </div>

      <div className="m-set-sec">Categories</div>
      <div className="m-set-card">
        {categories.map(cat => (
          <div key={cat.id} className="m-set-row">
            <div className="txt"><b><span className="m-dot" style={{ background: cat.color || accent }} />{cat.name}</b></div>
            <button className="m-icon-btn" aria-label={`Delete ${cat.name}`} onClick={() => onSheet({
              title: `Delete “${cat.name}”?`,
              items: [{ label: 'Delete category', icon: Trash2, action: () => removeCategory(cat.id) }],
            })}><Trash2 size={18} /></button>
          </div>
        ))}
        <form className="m-set-row" onSubmit={e => { e.preventDefault(); if (newCategory.trim()) { addCategory(newCategory.trim()); setNewCategory(''); } }}>
          <input className="m-input" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New category" />
          <button className="m-icon-btn" type="submit" aria-label="Add category" disabled={!newCategory.trim()}><Plus size={20} /></button>
        </form>
      </div>

      <div className="m-set-sec">Appearance</div>
      <div className="m-set-card">
        <Row title="Accent color" stack>
          <div className="m-swatches round">
            {ACCENTS.map(color => (
              <button key={color} aria-label={color} className={accent.toLowerCase() === color ? 'on' : ''} style={{ background: color }} onClick={() => updateSetting('accentColor', color)}>
                {accent.toLowerCase() === color && <Check size={16} color="#fff" />}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <div className="m-set-sec">Data</div>
      <div className="m-set-card">
        <button className="m-set-row danger" onClick={() => confirmClear('History', 'history')}><div className="txt"><b>Clear history</b></div><Trash2 size={18} /></button>
        <button className="m-set-row danger" onClick={() => confirmClear('Reading progress', 'progress')}><div className="txt"><b>Clear reading progress</b></div><Trash2 size={18} /></button>
        <button className="m-set-row danger" onClick={() => confirmClear('Reading time', 'readingTime')}><div className="txt"><b>Clear reading time</b></div><Trash2 size={18} /></button>
      </div>

      <div className="m-set-sec">About</div>
      <div className="m-set-card">
        <Row title="Version"><span className="m-dim">{import.meta.env.PACKAGE_VERSION || ''}</span></Row>
        <Row title="Extension engine" sub="Adapted from Mihon (Apache-2.0). Extensions come from the Keiyoushi store." />
      </div>
    </div>
  );
});

export default MobileSettings;
