import React, { memo, useState } from 'react';
import {
  Plus, Trash2, Check, Upload, Download, Cloud, RefreshCw, LogOut, Puzzle, BookOpen, Maximize2, Sun, Palette,
  BellRing, HardDrive, Brush, History, Clock, Bookmark, Info, Mail,
} from 'lucide-react';
import GoogleLogo from '../components/GoogleLogo';
import { useData } from '../contexts/DataContext';
import { storage, timeAgo } from '../utils/helpers';
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

// A leading icon tile keeps long settings lists scannable.
const Tile = ({ icon: Icon, tone }) => (Icon ? <span className={`m-tile ${tone || ''}`}><Icon size={17} /></span> : null);

const Row = ({ title, sub, children, stack, icon, tone, end }) => (
  <div className={`m-set-row ${stack ? 'stack' : ''}`}>
    {stack ? (
      <div className="head"><Tile icon={icon} tone={tone} /><div className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</div>{end}</div>
    ) : (<><Tile icon={icon} tone={tone} /><div className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</div>{end}</>)}
    {children}
  </div>
);

const Action = ({ title, sub, icon, tone, onClick, disabled, danger }) => (
  <button className={`m-set-row ${danger ? 'danger' : ''}`} disabled={disabled} onClick={onClick}>
    <Tile icon={icon} tone={danger ? 'red' : tone} />
    <div className="txt"><b>{title}</b>{sub && <small>{sub}</small>}</div>
  </button>
);

// Account sync: sign-in form, or the signed-in account with its sync status.
const SyncCard = memo(({ onSheet }) => {
  const { cloudSession, cloudStatus, cloudSignIn, cloudSignInWithGoogle, cloudSignOut, runCloudSync } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await cloudSignIn(email.trim(), password, creating);
      setPassword('');
    } catch (err) {
      setError(err?.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await cloudSignInWithGoogle();
    } catch (err) {
      setError(err?.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  if (cloudSession) {
    const status = cloudStatus.state === 'syncing' ? 'Syncing…'
      : cloudStatus.state === 'error' ? cloudStatus.error
        : cloudStatus.lastSyncAt ? `Last synced ${timeAgo(cloudStatus.lastSyncAt)}` : 'Not synced yet';
    const email = cloudSession.user?.email || 'Signed in';
    const syncing = cloudStatus.state === 'syncing';
    return (
      <div className="m-set-card">
        <div className="m-account">
          <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
          <div className="txt">
            <b className="m-ellipsis">{email}</b>
            <small className={`state ${cloudStatus.state}`}><i />{status}</small>
          </div>
        </div>
        <div className="m-account-actions">
          <button className="m-btn quiet small" disabled={syncing} onClick={runCloudSync}><RefreshCw size={15} className={syncing ? 'm-rotate' : ''} />{syncing ? 'Syncing…' : 'Sync now'}</button>
          <button className="m-btn quiet small" onClick={() => onSheet({
            title: 'Sign out? Your library stays on this phone; it just stops syncing.',
            items: [{ label: 'Sign out', icon: LogOut, action: cloudSignOut }],
          })}><LogOut size={15} />Sign out</button>
        </div>
        {cloudStatus.waiting?.map(w => (
          <Row key={w.source} icon={Puzzle} tone="amber" title={`${w.count} title${w.count === 1 ? '' : 's'} waiting for ${w.source}`} sub="Installs on its own if your PC has it; otherwise get it in Browse > Extensions." />
        ))}
        <Row icon={Cloud} tone="blue" title="What syncs" sub="Library, reading progress, read chapters and extensions. Downloads, categories and settings stay on this phone." />
      </div>
    );
  }

  return (
    <div className="m-set-card">
      <div className="m-sync-hero">
        <span className="m-tile big blue"><Cloud size={22} /></span>
        <b>{creating ? 'Create an account' : 'Sync with your PC'}</b>
        <small>Sign in with the same account on both, and your library and reading progress follow you.</small>
      </div>
      <form className="m-set-row stack" onSubmit={submit}>
        <button type="button" className="m-btn google" disabled={busy} onClick={google}><GoogleLogo size={19} />{busy ? 'Waiting for browser…' : 'Continue with Google'}</button>
        <div className="m-or"><span>or use email</span></div>
        <input className="m-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input className="m-input" type="password" autoComplete={creating ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder={creating ? 'Password (6+ characters)' : 'Password'} />
        {error && <small style={{ color: '#f87171', fontSize: 12.5 }}>{error}</small>}
        <button className="m-btn" type="submit" disabled={busy || !email.trim() || password.length < 6}><Mail size={17} />{busy ? 'Working…' : creating ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="m-btn quiet" onClick={() => { setCreating(v => !v); setError(''); }}>{creating ? 'I already have an account' : 'Create an account'}</button>
      </form>
    </div>
  );
});

const MobileSettings = memo(({ onSheet, backup }) => {
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
      <div className="m-set-sec">Sync</div>
      <SyncCard onSheet={onSheet} />

      <div className="m-set-sec">Reader</div>
      <div className="m-set-card">
        <Row icon={BookOpen} tone="orange" title="Default mode" stack><Segs value={settings?.readerMode || 'scroll'} options={READER_MODES} onChange={v => updateSetting('readerMode', v)} /></Row>
        <Row icon={Maximize2} tone="orange" title="Fit pages to" sub="Paged mode" stack><Segs value={settings?.fitMode || 'height'} options={FIT_MODES} onChange={v => updateSetting('fitMode', v)} /></Row>
        <Row icon={Sun} tone="orange" title="Brightness" end={<span className="m-val">{settings?.brightness || 100}%</span>} stack>
          <input type="range" min={40} max={160} value={settings?.brightness || 100} onChange={e => updateSetting('brightness', Number(e.target.value))} className="m-range" />
        </Row>
        <Row icon={Palette} tone="orange" title="Reader background" stack>
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
        <Row icon={BellRing} tone="green" title="Check for new chapters" stack><Segs grid value={interval} options={UPDATE_INTERVALS} onChange={v => updateSetting('chapterUpdateInterval', v)} /></Row>
        <Row icon={Download} tone="green" title="Auto-download new chapters" sub="Queue new chapters for offline reading"><Switch label="Auto-download new chapters" on={!!settings?.autoDownloadNewChapters} onChange={v => updateSetting('autoDownloadNewChapters', v)} /></Row>
      </div>

      <div className="m-set-sec">Downloads</div>
      <div className="m-set-card">
        <Row icon={HardDrive} tone="blue" title="Delete chapters after reading" sub="Frees space once a downloaded chapter is read"><Switch label="Delete chapters after reading" on={!!settings?.autoDeleteRead} onChange={v => updateSetting('autoDeleteRead', v)} /></Row>
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
        <Row icon={Brush} tone="pink" title="Accent color" stack>
          <div className="m-swatches round">
            {ACCENTS.map(color => (
              <button key={color} aria-label={color} className={accent.toLowerCase() === color ? 'on' : ''} style={{ background: color }} onClick={() => updateSetting('accentColor', color)}>
                {accent.toLowerCase() === color && <Check size={16} color="#fff" />}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <div className="m-set-sec">Backup</div>
      <p className="m-set-note">A one-off copy of everything, for safekeeping or moving without an account. Downloaded chapters aren't included.</p>
      <div className="m-set-card">
        <Action icon={Upload} tone="violet" title="Export backup" sub="Library, progress, history, categories, settings and extensions in one file" disabled={backup?.backupWorking} onClick={backup?.exportBackup} />
        <Action icon={Download} tone="violet" title="Restore backup" sub="Pick an akaReader backup .json file" disabled={backup?.backupWorking} onClick={() => onSheet({
          title: 'Restore a backup? It replaces the library, progress and settings on this phone.',
          items: [{ label: 'Choose backup file', icon: Download, action: backup?.importBackup }],
        })} />
      </div>

      <div className="m-set-sec">Data</div>
      <div className="m-set-card">
        <Action danger icon={History} title="Clear history" onClick={() => confirmClear('History', 'history')} />
        <Action danger icon={Bookmark} title="Clear reading progress" onClick={() => confirmClear('Reading progress', 'progress')} />
        <Action danger icon={Clock} title="Clear reading time" onClick={() => confirmClear('Reading time', 'readingTime')} />
      </div>

      <div className="m-set-sec">About</div>
      <div className="m-set-card">
        <Row icon={Info} tone="gray" title="Version" end={<span className="m-val">{import.meta.env.PACKAGE_VERSION || ''}</span>} />
        <Row icon={Puzzle} tone="gray" title="Extension engine" sub="Adapted from Mihon (Apache-2.0). Extensions come from the Keiyoushi store." />
      </div>
    </div>
  );
});

export default MobileSettings;
