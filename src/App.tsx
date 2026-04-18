import { useState, useEffect, useRef } from 'react'

interface LibraryEpisode {
  id: number;
  season: string;
  episode: string;
  episode_title: string | null;
  file_path: string;
}

interface LibrarySeries {
  id: number;
  title: string;
  mal_id: number | null;
  poster_url: string | null;
  synopsis: string | null;
  genres: string | null;
  score: number | null;
  episodes: LibraryEpisode[];
}

function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string>('') 
  const [library, setLibrary] = useState<LibrarySeries[]>([])
  const [selectedSeries, setSelectedSeries] = useState<LibrarySeries | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const fetchLibraryDB = async () => {
    try {
      const data = await window.api.getLibrary()
      setLibrary(data)
    } catch (error) {
      console.error("Failed to load DB:", error)
    }
  }

  const hasScanned = useRef(false)

  useEffect(() => {
    const initApp = async () => {
      if (hasScanned.current) return 
      hasScanned.current = true

      await fetchLibraryDB()
      
      const rootPath = localStorage.getItem('otakuVaultRoot')
      if (rootPath) {
        setIsScanning(true)
        const newData = await window.api.scanFiles(rootPath)
        setLibrary(newData)
        setIsScanning(false)
      }
    }
    initApp()
  }, [])

  const handleBrowse = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      setFolderPath(path) 
      localStorage.setItem('otakuVaultRoot', path) 
      setSelectedSeries(null)
      setIsScanning(true)
      
      const newData = await window.api.scanFiles(path)
      setLibrary(newData)
      setIsScanning(false)
    }
  }

  const handleRefresh = () => {
    fetchLibraryDB()
  }

  const handleHome = () => {
    setFolderPath('')
    setSelectedSeries(null)
  }

  const displayedLibrary = folderPath 
    ? library.filter(series => series.episodes.some(ep => ep.file_path.includes(folderPath)))
    : library

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #F43F5E; }
        .dot-bg {
          background-color: #0B0F19;
          background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>

      <div className="dot-bg" style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#F3F4F6' }}>
        
        {/* SIDEBAR */}
        <div style={{ width: '260px', backgroundColor: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(10px)', padding: '30px 20px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, boxShadow: '5px 0 25px rgba(0,0,0,0.5)' }}>
          
          <div style={{ position: 'relative', marginBottom: '40px', paddingLeft: '10px' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '0', fontSize: '3rem', color: 'rgba(255,255,255,0.03)', fontWeight: '900', userSelect: 'none', whiteSpace: 'nowrap' }}>
              オタク
            </div>
            <h2 style={{ margin: 0, color: '#F43F5E', fontSize: '1.8rem', letterSpacing: '-0.5px', fontWeight: '800', position: 'relative', zIndex: 1, textShadow: '0 0 15px rgba(244, 63, 94, 0.4)' }}>
              OTAKU<span style={{ color: '#E5E7EB' }}>VAULT</span>
            </h2>
          </div>
          
          <div 
            style={{ padding: '12px 16px', backgroundColor: !folderPath && !selectedSeries ? 'rgba(244, 63, 94, 0.1)' : 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', borderLeft: !folderPath && !selectedSeries ? '3px solid #F43F5E' : '3px solid transparent', color: !folderPath && !selectedSeries ? '#F43F5E' : '#E5E7EB' }} 
            onClick={handleHome}
            title="View your entire saved collection"
          >
            All Series
          </div>

          <div 
            style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: '600', color: '#9CA3AF', transition: 'color 0.2s' }} 
            onClick={handleRefresh}
            onMouseEnter={(e) => e.currentTarget.style.color = '#F3F4F6'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
            title="Refresh metadata for the current view"
          >
            Refresh View
          </div>

          {/* RESTORED PLACEHOLDERS (Emoji-free & clean) */}
          <div style={{ padding: '12px 16px', cursor: 'not-allowed', fontWeight: '600', color: '#4B5563' }} title="Coming in Iteration 3">
            Favorites
          </div>
          <div style={{ padding: '12px 16px', cursor: 'not-allowed', fontWeight: '600', color: '#4B5563' }} title="Coming in Iteration 3">
            Settings
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, padding: '40px 50px', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px' }}>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1px', textTransform: 'uppercase' }}>
                {selectedSeries ? selectedSeries.title : (folderPath ? 'Folder View' : 'My Collection')}
              </h1>
              <div style={{ fontSize: '0.95rem', color: '#F43F5E', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {isScanning ? 'SYSTEM: Scanning & Fetching...' : (selectedSeries ? '「 SERIES DETAILS 」' : (folderPath || '「 ENTIRE VAULT 」'))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
              {selectedSeries && (
                <button 
                  onClick={() => setSelectedSeries(null)}
                  style={{ padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#F3F4F6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', backdropFilter: 'blur(5px)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                >
                  Return
                </button>
              )}
              <button 
                onClick={handleBrowse}
                disabled={isScanning}
                style={{ padding: '12px 24px', background: isScanning ? '#374151' : 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: isScanning ? 'not-allowed' : 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: isScanning ? 'none' : '0 4px 15px rgba(244, 63, 94, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}
                onMouseEnter={(e) => { if(!isScanning) e.currentTarget.style.boxShadow = '0 6px 20px rgba(244, 63, 94, 0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { if(!isScanning) e.currentTarget.style.boxShadow = '0 4px 15px rgba(244, 63, 94, 0.4)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {isScanning ? 'Scanning...' : 'Scan Directory'}
              </button>
            </div>
          </div>

          {!selectedSeries && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '35px' }}>
              {displayedLibrary.map((series) => (
                <div 
                  key={series.id} 
                  onClick={() => setSelectedSeries(series)}
                  style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(5px)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.6), 0 0 15px rgba(244, 63, 94, 0.2)'; e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{ height: '320px', backgroundColor: '#0B0F19', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', position: 'relative' }}>
                    {series.poster_url ? (
                      <img src={series.poster_url} alt={series.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: '700', letterSpacing: '2px' }}>NO COVER</span>
                    )}
                    <div style={{ position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'rgba(11, 15, 25, 0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', color: '#F43F5E', fontWeight: '800', backdropFilter: 'blur(4px)', border: '1px solid rgba(244, 63, 94, 0.2)', letterSpacing: '1px' }}>
                      {series.episodes.length} EPS
                    </div>
                  </div>
                  <div style={{ padding: '18px' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', color: '#F9FAFB' }}>
                      {series.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedSeries && (
            <div>
              <div style={{ display: 'flex', gap: '30px', marginBottom: '50px', backgroundColor: 'rgba(17, 24, 39, 0.6)', padding: '35px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                {selectedSeries.poster_url && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${selectedSeries.poster_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, filter: 'blur(30px)', zIndex: 0 }}></div>
                )}
                
                {selectedSeries.poster_url ? (
                  <img src={selectedSeries.poster_url} alt="Poster" style={{ width: '200px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 1, border: '1px solid rgba(255,255,255,0.1)' }} />
                ) : (
                   <div style={{ width: '200px', height: '280px', backgroundColor: '#0B0F19', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontWeight: 'bold', zIndex: 1, border: '1px solid rgba(255,255,255,0.05)' }}>NO COVER</div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ background: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)', color: 'white', padding: '6px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(244, 63, 94, 0.3)' }}>
                      SCORE: {selectedSeries.score || 'N/A'}
                    </span>
                    <span style={{ color: '#E5E7EB', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '1px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {selectedSeries.genres ? selectedSeries.genres.toUpperCase() : 'GENRES LOADING...'}
                    </span>
                  </div>
                  <p style={{ color: '#D1D5DB', lineHeight: '1.8', fontSize: '1.05rem', overflowY: 'auto', maxHeight: '180px', paddingRight: '15px' }}>
                    {selectedSeries.synopsis || 'Synopsis loading or not available.'}
                  </p>
                </div>
              </div>

              <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '30px', fontSize: '1.5rem', color: '#F9FAFB', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#F43F5E' }}>//</span> EPISODES
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px' }}>
                {selectedSeries.episodes.map((ep) => (
                  <div key={ep.id} style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s', cursor: 'pointer', backdropFilter: 'blur(5px)' }} title={ep.file_path} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.5)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.4)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    
                    <div style={{ 
                      height: '110px', 
                      backgroundColor: '#111827', 
                      backgroundImage: selectedSeries.poster_url ? `url(${selectedSeries.poster_url})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center 20%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      position: 'relative',
                      borderBottom: '1px solid #1F2937' 
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.5), rgba(17, 24, 39, 0.95))' }}></div>
                      <span style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '2px', color: 'rgba(255,255,255,0.8)', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                        ▶ PLAY
                      </span>
                    </div>

                    <div style={{ padding: '18px' }}>
                      <div style={{ fontSize: '0.75rem', color: ep.season === '01' ? '#9CA3AF' : '#F43F5E', marginBottom: '8px', fontWeight: '800', letterSpacing: '1.5px' }}>
                         SEASON {ep.season}
                      </div>
                      <div style={{ fontWeight: '800', fontSize: '1.3rem', color: '#F3F4F6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Episode {ep.episode}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '6px', fontWeight: '500' }} title={ep.episode_title || 'Bonus'}>
                        {ep.episode_title || 'Bonus'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

export default App