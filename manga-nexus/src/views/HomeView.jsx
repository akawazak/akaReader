import React, { memo, useState, useMemo, useRef } from 'react';
import { BookOpen, Play, ChevronRight, ChevronLeft, Puzzle } from 'lucide-react';
import { timeAgo, proxyImg } from '../utils/helpers';
import { calculateMangaProgressPercent } from '../utils/readerProgress.mjs';
import { Btn } from '../components/ui/Btn';
import { MangaCard } from '../components/manga/MangaCard';

// Progress stores chapterNum as a string; '0' or '' means the number is unknown, not chapter zero.
const chapterLabel = (value) => {
  const text = value == null ? '' : String(value).trim();
  return text && text !== '0' ? text : '';
};

const HeroRow = memo(({ title, link, onLink, items, progress, getMangaKey, onSelect, showTime }) => {
  const scrollRef = useRef(null);
  const scroll = d => {
    if (scrollRef.current) {
      const w = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: d * (w * 0.75), behavior: 'smooth' });
    }
  };
  return (
    <section className="home-row">
      <div className="home-row-head">
        <h2>{title}</h2>
        {link && <button type="button" className="home-link" onClick={onLink}>{link} <ChevronRight size={14} /></button>}
        <div style={{ display: 'flex', gap: 6 }}>
          {[-1, 1].map(d => (
            <button key={d} type="button" className="home-arrow" aria-label={d < 0 ? 'Scroll left' : 'Scroll right'} onClick={() => scroll(d)}>
              {d < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          ))}
        </div>
      </div>
      <div ref={scrollRef} className="home-row-track">
        {items.map((m, i) => (
          <div key={getMangaKey(m.id, m.sourceId)} className="home-row-item">
            <MangaCard manga={m} onClick={onSelect} index={i} eager badge={showTime && m.lastRead ? timeAgo(m.lastRead) : null} category={m.categoryId} progress={calculateMangaProgressPercent(m, progress[getMangaKey(m.id, m.sourceId)]) || 0} />
          </div>
        ))}
      </div>
    </section>
  );
});

export const HomeView = memo(({ history, library, progress, sources, updates = [], stats = null, getMangaKey, onSelect, onContinue, onSwitchTab }) => {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const hero = useMemo(() => history.find(m => progress[getMangaKey(m.id, m.sourceId)]) || history[0] || null, [history, progress, getMangaKey]);
  const continueReading = useMemo(() => history.filter(m => progress[getMangaKey(m.id, m.sourceId)]).slice(0, 15), [history, progress, getMangaKey]);
  const recentLib = useMemo(() => [...library].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 20), [library]);
  const heroProgress = hero && progress[getMangaKey(hero.id, hero.sourceId)] ? progress[getMangaKey(hero.id, hero.sourceId)] : null;
  const heroProgressPercent = calculateMangaProgressPercent(hero, heroProgress);
  const sourceCount = Object.keys(sources).length;
  const heroChapter = chapterLabel(heroProgress?.chapterNum);
  const upNext = useMemo(() => continueReading.filter(m => m !== hero).slice(0, 3), [continueReading, hero]);
  const unreadByKey = useMemo(() => Object.fromEntries(updates.map(m => [getMangaKey(m.id, m.sourceId), m.newChapters || 0])), [updates, getMangaKey]);
  const newChapters = useMemo(() => updates.slice(0, 4).map(m => {
    const details = Array.isArray(m.newChapterDetails) ? m.newChapterDetails : [];
    const chapter = [...details].sort((a, b) => (Number(b.number) || 0) - (Number(a.number) || 0))[0] || null;
    return { manga: m, chapter, count: m.newChapters || details.length || 1 };
  }), [updates]);

  if (!hero && library.length === 0) return (
    <div className="anim-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 130px)', gap: 22, padding: '24px', textAlign: 'center' }}>
      <div style={{ width: 88, height: 88, borderRadius: 24, background: 'var(--accent-pale)', border: '1px solid var(--accent-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 48px var(--accent-glow)' }}><BookOpen size={38} style={{ color: 'var(--accent)' }} /></div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30, marginBottom: 10, letterSpacing: 0 }}>Welcome to akaReader</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.65, maxWidth: 500, margin: '0 auto' }}>
          {sourceCount === 0 ? 'Start your journey by installing extensions, then browse amazing sources to find manga you love.' : `You have ${sourceCount} sources ready. Immerse yourself in a new world.`}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {sourceCount === 0 && <Btn size="lg" onClick={() => onSwitchTab('extensions')} icon={Puzzle}>Install Extensions</Btn>}
        <Btn size="lg" variant={sourceCount ? 'default' : 'outline'} onClick={() => onSwitchTab('browse')} icon={BookOpen}>Browse Catalogs</Btn>
      </div>
    </div>
  );
return (
    <div className="anim-fadeIn" style={{ paddingBottom: 60 }}>
      {hero && (
        <div className="home-top">
          <section className="home-cont" aria-label={heroProgress ? 'Continue reading' : 'Last opened'}>
            {hero.cover && <img className="home-cont-bg" src={proxyImg(hero.cover)} alt="" aria-hidden="true" />}
            <div className="home-cont-fade" />
            <button type="button" className="home-cont-poster" onClick={() => onSelect(hero)} aria-label={`Open ${hero.title}`}>
              {hero.cover
                ? <img src={proxyImg(hero.cover)} alt="" onLoad={() => setHeroLoaded(true)} style={{ opacity: heroLoaded ? 1 : 0 }} />
                : <BookOpen size={40} style={{ color: 'var(--muted)', opacity: 0.5 }} />}
            </button>
            <div className="home-cont-info">
              <p className="home-kicker">
                {heroProgress ? 'Continue reading' : 'Last opened'}
                {heroProgress?.lastRead ? <span> · {timeAgo(heroProgress.lastRead)}</span> : null}
              </p>
              <h1 className="home-cont-title">{hero.title}</h1>
              <p className="home-cont-meta">{[heroChapter && `Chapter ${heroChapter}`, hero.author].filter(Boolean).join(' · ')}</p>
              {heroProgressPercent > 0 && (
                <div className="home-cont-progress">
                  <div className="home-bar"><i style={{ width: `${heroProgressPercent}%` }} /></div>
                  <span>{Math.round(heroProgressPercent)}%</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn size="lg" icon={Play} onClick={() => onContinue ? onContinue(hero) : onSelect(hero)}>
                  {heroProgress ? (heroChapter ? `Resume chapter ${heroChapter}` : 'Resume') : 'Start reading'}
                </Btn>
                <Btn size="lg" variant="outline" onClick={() => onSelect(hero)}>Details</Btn>
              </div>
            </div>
          </section>

          {upNext.length > 0 && (
            <section className="home-upnext" aria-label="Up next">
              <h2>Up next</h2>
              {upNext.map(m => {
                const saved = progress[getMangaKey(m.id, m.sourceId)];
                const pct = calculateMangaProgressPercent(m, saved);
                const unread = unreadByKey[getMangaKey(m.id, m.sourceId)];
                return (
                  <button key={getMangaKey(m.id, m.sourceId)} type="button" className="home-upnext-item" onClick={() => (onContinue || onSelect)(m)}>
                    <span className="thumb">{m.cover ? <img src={proxyImg(m.cover)} alt="" /> : <BookOpen size={14} />}</span>
                    <span className="txt">
                      <b>{m.title}</b>
                      <small>{[chapterLabel(saved?.chapterNum) && `Ch. ${chapterLabel(saved.chapterNum)}`, unread ? `${unread} new` : null].filter(Boolean).join(' · ') || 'Resume'}</small>
                      {pct > 0 && <span className="home-bar thin"><i style={{ width: `${pct}%` }} /></span>}
                    </span>
                    <span className="when">{saved?.lastRead ? timeAgo(saved.lastRead) : ''}</span>
                  </button>
                );
              })}
              {continueReading.length > upNext.length + 1 && (
                <button type="button" className="home-link" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => onSwitchTab('history')}>
                  {continueReading.length - upNext.length - 1} more in progress <ChevronRight size={14} />
                </button>
              )}
            </section>
          )}

          {upNext.length === 0 && stats && (
            <section className="home-upnext home-stats" aria-label="Your reading">
              <h2>Your reading</h2>
              <div className="home-stat-grid">
                <div><b className="accent">{stats.streak || 0}</b><small>day streak</small></div>
                <div><b>{(stats.totalChapters || 0).toLocaleString()}</b><small>chapters read</small></div>
                <div><b>{stats.totalMinutes >= 60 ? `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m` : `${stats.totalMinutes || 0}m`}</b><small>reading time</small></div>
                <div><b>{library.length}</b><small>in library</small></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                <Btn variant="outline" size="sm" icon={BookOpen} onClick={() => onSwitchTab('browse')}>Find something new</Btn>
                <Btn variant="ghost" size="sm" onClick={() => onSwitchTab('library')}>Open library</Btn>
              </div>
            </section>
          )}
        </div>
      )}

      {newChapters.length > 0 && (
        <section className="home-row">
          <div className="home-row-head">
            <h2>New chapters</h2>
            <button type="button" className="home-link" onClick={() => onSwitchTab('updates')}>All updates <ChevronRight size={14} /></button>
          </div>
          <div className="home-new">
            {newChapters.map(({ manga, chapter, count }) => (
              <button key={getMangaKey(manga.id, manga.sourceId)} type="button" className="home-new-item" onClick={() => onSelect(manga)}>
                <span className="thumb">{manga.cover ? <img src={proxyImg(manga.cover)} alt="" /> : <BookOpen size={16} />}</span>
                <span className="txt">
                  <b>{manga.title}</b>
                  <em>{chapter?.number !== '' && chapter?.number != null ? `Ch. ${chapter.number}` : (chapter?.name || 'New chapter')}{count > 1 ? ` +${count - 1} more` : ''}</em>
                  <small>{[chapter?.publishedAt || chapter?.date ? timeAgo(chapter.publishedAt || chapter.date) : null, sources[manga.sourceId]?.name].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recentLib.length > 0 && <HeroRow title="Recently added" link="Library" onLink={() => onSwitchTab('library')} items={recentLib} progress={progress} getMangaKey={getMangaKey} onSelect={onSelect} />}
    </div>
  );
});
