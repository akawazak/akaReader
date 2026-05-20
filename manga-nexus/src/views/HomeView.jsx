import React, { memo, useState, useMemo, useRef } from 'react';
import { BookOpen, Clock, Play, Sparkles, BellRing, ChevronRight, ChevronLeft, Globe, Download, Library, Pen, Puzzle } from 'lucide-react';
import { timeAgo, proxyImg } from '../utils/helpers';
import { Btn } from '../components/ui/Btn';
import { MangaCard } from '../components/manga/MangaCard';

const HeroRow = memo(({ title, icon: Icon, items, progress, getMangaKey, onSelect, showTime }) => {
  const scrollRef = useRef(null);
  const scroll = d => {
    if (scrollRef.current) {
      const w = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: d * (w * 0.75), behavior: 'smooth' });
    }
  };
  return (
    <div style={{ marginBottom: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '0 8px' }}>
        {Icon && (
          <div style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--accent-pale)', border: '1px solid var(--accent-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px var(--accent-glow)' }}>
            <Icon size={20} style={{ color: 'var(--accent)' }} />
          </div>
        )}
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, flex: 1, letterSpacing: '-0.02em', color: 'var(--text)' }}>{title}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {[-1, 1].map(d => (
            <button key={d} onClick={() => scroll(d)} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-pale)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.transform = 'none'; }}>
              {d < 0 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin: '0 -32px', padding: '0 32px 24px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div ref={scrollRef} style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' }}>
          {items.map((m, i) => (
            <div key={getMangaKey(m.id, m.sourceId)} style={{ width: 180, minWidth: 180, flexShrink: 0, scrollSnapAlign: 'start' }}>
              <MangaCard manga={m} onClick={onSelect} index={i} eager badge={showTime && m.lastRead ? timeAgo(m.lastRead) : null} category={m.categoryId} progress={(progress[getMangaKey(m.id, m.sourceId)]?.chapterNum / (m.totalChapters || 100)) * 100 || 0} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export const HomeView = memo(({ history, library, progress, sources, updates, getMangaKey, onSelect, onContinue, onSwitchTab }) => {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const hero = useMemo(() => history.find(m => progress[getMangaKey(m.id, m.sourceId)]) || history[0] || null, [history, progress, getMangaKey]);
  const continueReading = useMemo(() => history.filter(m => progress[getMangaKey(m.id, m.sourceId)]).slice(0, 15), [history, progress, getMangaKey]);
  const recentLib = useMemo(() => [...library].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 20), [library]);
  const heroProgress = hero && progress[getMangaKey(hero.id, hero.sourceId)] ? progress[getMangaKey(hero.id, hero.sourceId)] : null;
  const sourceCount = Object.keys(sources).length;

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
    <div className="anim-fadeIn" style={{ paddingBottom: 100 }}>
      {hero && (
        <div style={{ position: 'relative', height: 740, overflow: 'hidden', marginBottom: 60, marginTop: -42, borderRadius: '0 0 48px 48px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
          {/* Spatial Background */}
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', zIndex: 0 }}>
            {hero.cover && (
              <img src={proxyImg(hero.cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(100px) brightness(0.3) saturate(3)', transform: 'scale(1.5)', pointerEvents: 'none' }} />
            )}
            <div className="anim-aura" style={{ position: 'absolute', top: '-20%', left: '10%', width: '60%', height: '80%', background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', mixBlendMode: 'screen', filter: 'blur(80px)' }} />
            <div className="anim-aura" style={{ position: 'absolute', bottom: '-10%', right: '10%', width: '50%', height: '70%', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)', mixBlendMode: 'screen', filter: 'blur(80px)', animationDelay: '2s' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg) 0%, transparent 60%)', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(5,7,12,0.95) 0%, rgba(5,7,12,0.6) 45%, transparent 100%)', zIndex: 1 }} />
          </div>

          <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', height: '100%', padding: '0 80px', maxWidth: 1600, margin: '0 auto', gap: 80, perspective: 1200 }}>
            
            {/* Massive Typography & Info (Left) */}
            <div className="anim-fadeInUp" style={{ flex: 1, zIndex: 15 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 100, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', marginBottom: 32, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />
                <span style={{ fontSize: 13, letterSpacing: '0.2em', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{heroProgress ? 'Continue Reading' : 'Featured Masterpiece'}</span>
              </div>

              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(48px, 7vw, 96px)', lineHeight: 1.05, marginBottom: 24, letterSpacing: '-0.04em', textShadow: '0 16px 48px rgba(0,0,0,0.8)', color: '#fff', maxWidth: 800 }}>
                {hero.title}
              </h1>

              {hero.author && (
                <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Pen size={20} style={{ color: 'var(--accent)' }} /> {hero.author}
                </p>
              )}

              <div style={{ display: 'flex', gap: 20 }}>
                <Btn size="lg" icon={Play} onClick={() => onContinue ? onContinue(hero) : onSelect(hero)} style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', color: '#fff', borderRadius: 24, padding: '0 48px', fontSize: 18, fontWeight: 900, boxShadow: '0 24px 48px var(--accent-glow), inset 0 2px 0 rgba(255,255,255,0.2)', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', border: 'none', height: 68, letterSpacing: '0.02em' }} className="hover-lift">
                  {heroProgress ? 'Continue' : 'Start Reading'}
                </Btn>
                <Btn size="lg" variant="outline" icon={BookOpen} onClick={() => onSelect(hero)} style={{ borderRadius: 24, backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0 40px', height: 68, fontSize: 18, fontWeight: 700, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)' }} className="hover-lift">
                  Details
                </Btn>
              </div>
            </div>

            {/* Spatial Floating Poster (Right) */}
            <div className="anim-fadeIn" style={{ flexShrink: 0, width: 340, position: 'relative', animationDelay: '200ms' }}>
              <div className="anim-spatial" style={{ width: '100%', height: 500, borderRadius: 32, position: 'relative', transformStyle: 'preserve-3d' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--card)', borderRadius: 32, border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden', transform: 'translateZ(20px)' }}>
                  {hero.cover ? (
                    <img src={proxyImg(hero.cover)} alt={hero.title} onLoad={() => setHeroLoaded(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: heroLoaded ? 1 : 0, transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={64} style={{ color: 'var(--muted)', opacity: 0.5 }} /></div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 40%)', zIndex: 10, pointerEvents: 'none' }} />
                </div>
                
                {/* Floating Stats Badges */}
                {heroProgress && (
                  <>
                    <div style={{ position: 'absolute', bottom: -20, left: -40, background: 'rgba(10,12,20,0.65)', backdropFilter: 'blur(30px) saturate(2)', border: '1px solid rgba(255,255,255,0.15)', padding: '20px 28px', borderRadius: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.6)', transform: 'translateZ(60px)', zIndex: 20 }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 8 }}>Current Chapter</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{heroProgress.chapterNum}</div>
                    </div>
                    <div style={{ position: 'absolute', top: 40, right: -30, background: 'rgba(10,12,20,0.65)', backdropFilter: 'blur(30px) saturate(2)', border: '1px solid rgba(255,255,255,0.15)', padding: '16px', borderRadius: 20, boxShadow: '0 24px 48px rgba(0,0,0,0.6)', transform: 'translateZ(40px)', zIndex: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Clock size={20} style={{ color: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>Last Read</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{timeAgo(heroProgress.lastRead)}</div>
                      </div>
                    </div>
                    {/* Floating Progress Bar */}
                    <div style={{ position: 'absolute', bottom: 30, right: -20, background: 'rgba(10,12,20,0.65)', backdropFilter: 'blur(30px) saturate(2)', border: '1px solid rgba(255,255,255,0.15)', padding: '16px 20px', borderRadius: 20, boxShadow: '0 24px 48px rgba(0,0,0,0.6)', transform: 'translateZ(50px)', zIndex: 19, width: 220 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        <span>Progress</span>
                        <span style={{ color: 'var(--accent)' }}>{Math.round((heroProgress.chapterNum / (hero.totalChapters || 100)) * 100)}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((heroProgress.chapterNum / (hero.totalChapters || 100)) * 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #fbd38d)', borderRadius: 3, boxShadow: '0 0 12px var(--accent-glow)' }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 64px' }}>

        {updates.length > 0 && (
          <div className="anim-fadeInUp hover-lift" onClick={() => onSwitchTab('updates')} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 28px', borderRadius: 24, marginBottom: 56, background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.02))', border: '1px solid rgba(249,115,22,0.2)', cursor: 'pointer', backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, var(--accent), #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px var(--accent-glow)' }}>
              <BellRing size={26} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>New Chapters Available</h3>
              <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>{updates.length} manga in your library have new releases waiting for you.</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={24} style={{ color: '#fff' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 64 }}>
          {[
            { label: 'Browse Catalogs', icon: Globe, id: 'browse', sub: `Explore ${sourceCount} directories`, color: '#3b82f6', bgUrl: 'radial-gradient(circle at top right, rgba(59,130,246,0.15), transparent 70%)' },
            { label: 'Smart Discover', icon: Sparkles, id: 'recommendations', sub: 'Find based on your mood', color: '#a855f7', bgUrl: 'radial-gradient(circle at top right, rgba(168,85,247,0.15), transparent 70%)' },
            { label: 'Downloads', icon: Download, id: 'downloads', sub: 'Manage offline reading', color: '#10b981', bgUrl: 'radial-gradient(circle at top right, rgba(16,185,129,0.15), transparent 70%)' }
          ].map(({ label, icon: Icon, id, sub, color, bgUrl }, i) => (
            <button key={id} onClick={() => onSwitchTab(id)} className={`anim-fadeInUp delay-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '28px 32px', borderRadius: 28, cursor: 'pointer', background: 'var(--card)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', position: 'relative', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 24px 64px ${color}30, 0 0 0 1px ${color}40 inset`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'; }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', background: bgUrl, pointerEvents: 'none' }} />
              <div style={{ width: 64, height: 64, borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 8px 24px ${color}20` }}>
                <Icon size={28} style={{ color }} />
              </div>
              <div style={{ zIndex: 1, flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>{sub}</p>
              </div>
              <ChevronRight size={24} style={{ color: 'var(--muted)', zIndex: 1 }} />
            </button>
          ))}
        </div>

        {continueReading.length > 0 && <HeroRow title="Jump Back In" icon={Clock} items={continueReading} progress={progress} getMangaKey={getMangaKey} onSelect={onContinue || onSelect} showTime />}
        
        {recentLib.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <HeroRow title="Recently Added to Library" icon={Library} items={recentLib} progress={progress} getMangaKey={getMangaKey} onSelect={onSelect} showTime />
          </div>
        )}
      </div>
    </div>
  );
});
