import React, { useState, useMemo, memo } from 'react';
import { Search, Library, Trash2, LayoutGrid, List, Columns, BookOpen, ChevronDown, ChevronRight, Check, X, ArrowRight } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { MangaCard, MangaListCard } from '../manga/MangaCard';
import { Btn } from '../ui/Btn';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { CATEGORIES } from '../../constants';

export const LibraryTab = memo(({ onSelect }) => {
  const { 
    library, history, progress, mangaCategories, toggleLibrary, 
    libraryView, updateSetting, readChapters, librarySearch, setLibrarySearch,
    librarySort, setLibrarySort
  } = useData();

  const [activeCategory, setActiveCategory] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const filteredLibrary = useMemo(() => {
    let result = library.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(librarySearch.toLowerCase());
      const matchesCategory = activeCategory === 'all' || mangaCategories[m.id] === activeCategory;
      return matchesSearch && matchesCategory;
    });

    if (librarySort === 'alpha') result.sort((a, b) => a.title.localeCompare(b.title));
    else if (librarySort === 'recent') result.sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0));
    else if (librarySort === 'added') result.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    
    return result;
  }, [library, librarySearch, activeCategory, mangaCategories, librarySort]);

  return (
    <div className="anim-fadeIn">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setActiveCategory('all')} style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: activeCategory === 'all' ? 'var(--accent)' : 'var(--card)', color: activeCategory === 'all' ? '#fff' : 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: activeCategory === 'all' ? '0 4px 16px rgba(249,115,22,0.3)' : 'none', transition: 'all 0.2s' }}>All ({library.length})</button>
        {CATEGORIES.map(cat => {
          const count = library.filter(m => mangaCategories[m.id] === cat.id).length;
          return <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: activeCategory === cat.id ? cat.color : 'var(--card)', color: activeCategory === cat.id ? '#fff' : 'var(--text-dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: count === 0 ? 0.5 : 1, boxShadow: activeCategory === cat.id ? `0 4px 16px ${cat.color}40` : 'none', transition: 'all 0.2s' }}>{cat.name} ({count})</button>;
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input placeholder="Search library..." value={librarySearch}
            onChange={e => setLibrarySearch(e.target.value)}
            style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 36px 9px 38px', color: 'var(--text)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          {librarySearch && <button onClick={() => setLibrarySearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={13} /></button>}
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <select value={librarySort} onChange={e => setLibrarySort(e.target.value)}
            style={{ appearance: 'none', WebkitAppearance: 'none', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 32px 9px 14px', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', transition: 'border-color .2s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}>
            <option value="recent">Last Read</option>
            <option value="added">Date Added</option>
            <option value="alpha">A → Z</option>
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['grid', <LayoutGrid size={16} />], ['list', <List size={16} />]].map(([m, icon]) => (
            <Btn key={m} variant={libraryView === m ? 'default' : 'ghost'} size="icon"
              onClick={() => updateSetting('libraryView', m)}>{icon}</Btn>
          ))}
        </div>
      </div>

      {filteredLibrary.length === 0 ? (
        <EmptyState icon={Library} title="Library empty" sub="Browse manga to add to your library" action={<Btn onClick={() => {}}>Go to Browse</Btn>} />
      ) : libraryView === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredLibrary.map((m, i) => (
            <MangaListCard key={m.id} manga={m} onClick={onSelect} index={i} category={mangaCategories[m.id]} progress={progress[m.id] ? Math.round((parseInt(progress[m.id].chapterNum) || (m.totalChapters || 100)) / Math.max(m.totalChapters || 1, 1) * 100) : 0} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 18 }}>
          {filteredLibrary.map((m, i) => (
            <MangaCard key={m.id} manga={m} onClick={onSelect} index={i} category={mangaCategories[m.id]} progress={progress[m.id] ? Math.round((parseInt(progress[m.id].chapterNum) || (m.totalChapters || 100)) / Math.max(m.totalChapters || 1, 1) * 100) : 0} />
          ))}
        </div>
      )}
    </div>
  );
});
