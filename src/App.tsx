import { useState, useEffect, useRef, useMemo } from 'react'

interface LibraryEpisode {
  id: number;
  season: string;
  episode: string;
  episode_title: string | null;
  file_path: string;
  is_watched: number;
}

interface LibrarySeries {
  id: number;
  title: string;
  mal_id: number | null;
  poster_url: string | null;
  synopsis: string | null;
  genres: string | null;
  score: number | null;
  is_favorite: number;
  user_rating: number;
  episodes: LibraryEpisode[];
}

function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string>('') 
  const [library, setLibrary] = useState<LibrarySeries[]>([])
  const [selectedSeries, setSelectedSeries] = useState<LibrarySeries | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  
  const [currentView, setCurrentView] = useState<'library' | 'favorites' | 'settings'>('library')
  const [genreFilter, setGenreFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isGenreOpen, setIsGenreOpen] = useState(false)

  const fetchLibraryDB = async () => {
    try {
      const data = await window.api.getLibrary()
      setLibrary(data)
      
      setSelectedSeries(prev => {
        if (!prev) return null;
        return data.find(s => s.id === prev.id) || prev;
      })
    } catch (error) {
      console.error("Failed to load DB:", error)
    }
  }

  const hasScanned = useRef(false)

  useEffect(() => {
    window.api.onMetadataUpdate(() => fetchLibraryDB())

    const initApp = async () => {
      if (hasScanned.current) return 
      hasScanned.current = true
      await fetchLibraryDB()
      
      const rootPath = localStorage.getItem('otakuVaultRoot')
      if (rootPath) {
        setFolderPath(rootPath)
      }
    }
    initApp()
  }, [])

  const handleBrowse = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      setFolderPath(path) 
      
      if (currentView === 'settings') {
        localStorage.setItem('otakuVaultRoot', path)
        await window.api.saveSettings(path)
      }
      
      setSelectedSeries(null)
      setIsScanning(true)
      
      const newData = await window.api.scanFiles(path)
      setLibrary(newData)
      setIsScanning(false)
    }
  }

  const handleToggleFavorite = async (id: number) => {
    await window.api.toggleFavorite(id);
    fetchLibraryDB();
  }

  const handleToggleWatched = async (ep: LibraryEpisode, series: LibrarySeries, e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    const isCurrentlyWatched = ep.is_watched === 1;
    const targetStatus = isCurrentlyWatched ? 0 : 1;

    let idsToUpdate = [ep.id];

    if (targetStatus === 1) {
      const epIndex = series.episodes.findIndex(e => e.id === ep.id);
      idsToUpdate = series.episodes.slice(0, epIndex + 1).map(e => e.id);
    }

    await window.api.updateWatchedStatus(idsToUpdate, targetStatus);
    fetchLibraryDB();
  }

  const handleRateSeries = async (id: number, score: number) => {
    await window.api.updateRating(id, score);
    fetchLibraryDB();
  }

  const handleCleanLibrary = async () => {
    if (window.confirm("This will remove all database entries for files that have been deleted from your hard drive. Continue?")) {
      const newData = await window.api.cleanLibrary();
      setLibrary(newData);
      alert("Library cleaned successfully.");
    }
  }

  const handleNukeDatabase = async () => {
    if (window.confirm("WARNING: This will DESTROY all your library data, favorites, watch progress, and ratings. Are you absolutely sure?")) {
      const newData = await window.api.nukeDatabase();
      setLibrary(newData);
      setSelectedSeries(null);
      setFolderPath('');
      localStorage.removeItem('otakuVaultRoot');
      alert("Database has been reset to factory defaults.");
    }
  }

  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    library.forEach(s => {
      if (s.genres) s.genres.split(', ').forEach(g => genres.add(g));
    });
    return Array.from(genres).sort();
  }, [library]);

  const displayedLibrary = useMemo(() => {
    let filtered = library;
    
    if (currentView === 'library') {
      if (folderPath) {
        filtered = filtered.filter(series => 
          series.episodes.some(ep => ep.file_path.includes(folderPath))
        );
      }
    } else if (currentView === 'favorites') {
      filtered = filtered.filter(s => s.is_favorite === 1);
    }
    
    if (genreFilter) {
      filtered = filtered.filter(s => s.genres && s.genres.includes(genreFilter));
    }

    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.title.toLowerCase().includes(lowerQuery));
    }
    
    return filtered;
  }, [library, currentView, genreFilter, folderPath, searchQuery]);

  const nextUpList = useMemo(() => {
    const list: { series: LibrarySeries, episode: LibraryEpisode }[] = [];
    
    for (const s of library) {
      let highestWatchedIndex = -1;
      for (let i = s.episodes.length - 1; i >= 0; i--) {
        if (s.episodes[i].is_watched === 1) {
          highestWatchedIndex = i;
          break;
        }
      }

      if (highestWatchedIndex !== -1 && highestWatchedIndex < s.episodes.length - 1) {
        list.push({ series: s, episode: s.episodes[highestWatchedIndex + 1] });
      }
    }
    
    return list;
  }, [library]);

  const renderSidebarItem = (viewName: 'library' | 'favorites' | 'settings', label: string) => {
    const isActive = currentView === viewName && !selectedSeries;
    return (
      <div 
        onClick={() => { 
          setCurrentView(viewName); 
          setSelectedSeries(null); 
          setGenreFilter(''); 
          setSearchQuery('');
          
          if (viewName === 'library') {
            const rootPath = localStorage.getItem('otakuVaultRoot') || '';
            setFolderPath(rootPath);

            if (rootPath && !isScanning) {
              setIsScanning(true);
              window.api.scanFiles(rootPath).then(newData => {
                setLibrary(newData);
                setIsScanning(false);
              });
            }
          }
        }}
        style={{ padding: '12px 16px', backgroundColor: isActive ? 'rgba(244, 63, 94, 0.1)' : 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', borderLeft: isActive ? '3px solid #F43F5E' : '3px solid transparent', color: isActive ? '#F43F5E' : '#E5E7EB' }} 
      >
        {label}
      </div>
    )
  }

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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .star-hover:hover { color: #F59E0B !important; transform: scale(1.2); }
      `}</style>

      <div className="dot-bg" style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#F3F4F6' }}>
        
        {/* SIDEBAR */}
        <div style={{ width: '260px', backgroundColor: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(10px)', padding: '30px 20px', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, boxShadow: '5px 0 25px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'relative', marginBottom: '40px', paddingLeft: '10px' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '0', fontSize: '3rem', color: 'rgba(255,255,255,0.03)', fontWeight: '900', userSelect: 'none', whiteSpace: 'nowrap' }}>オタク</div>
            <h2 style={{ margin: 0, color: '#F43F5E', fontSize: '1.8rem', letterSpacing: '-0.5px', fontWeight: '800', position: 'relative', zIndex: 1, textShadow: '0 0 15px rgba(244, 63, 94, 0.4)' }}>
              OTAKU<span style={{ color: '#E5E7EB' }}>VAULT</span>
            </h2>
          </div>
          
          {renderSidebarItem('library', 'All Series')}
          {renderSidebarItem('favorites', 'Favorites ♥')}
          {renderSidebarItem('settings', 'Settings')}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, padding: '40px 50px', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px' }}>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1px', textTransform: 'uppercase' }}>
                {selectedSeries ? selectedSeries.title : (currentView === 'library' ? 'My Collection' : currentView === 'favorites' ? 'My Favorites' : 'Vault Settings')}
              </h1>
              <div style={{ fontSize: '0.95rem', color: '#F43F5E', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <span>{isScanning ? 'SYSTEM: Scanning Hard Drive...' : (selectedSeries ? '「 SERIES DETAILS 」' : `「 ${currentView.toUpperCase()} VIEW 」`)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
              
              {/* Search Bar */}
              {!selectedSeries && currentView !== 'settings' && (
                <input 
                  type="text" 
                  placeholder="Search Library..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#F3F4F6', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '6px', outline: 'none', width: '220px', fontWeight: '500' }}
                />
              )}

              {/* GENRE DROPDOWN */}
              {!selectedSeries && currentView !== 'settings' && allGenres.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setIsGenreOpen(!isGenreOpen)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#F3F4F6', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', userSelect: 'none', display: 'flex', gap: '10px', alignItems: 'center', minWidth: '150px', justifyContent: 'space-between' }}
                  >
                    <span>{genreFilter || 'ALL GENRES'}</span>
                    <span style={{ fontSize: '0.8rem', transform: isGenreOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                  </div>

                  {/* Dropdown Menu */}
                  {isGenreOpen && (
                    <>
                      <div onClick={() => setIsGenreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
                      
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50, minWidth: '100%', maxHeight: '300px', overflowY: 'auto' }}>
                        <div 
                          onClick={() => { setGenreFilter(''); setIsGenreOpen(false); }}
                          style={{ padding: '10px 15px', cursor: 'pointer', fontWeight: '600', borderBottom: '1px solid rgba(255,255,255,0.05)', color: genreFilter === '' ? '#F43F5E' : '#D1D5DB' }}
                        >
                          ALL GENRES
                        </div>
                        {allGenres.map(g => (
                          <div 
                            key={g} 
                            onClick={() => { setGenreFilter(g); setIsGenreOpen(false); }}
                            style={{ padding: '10px 15px', cursor: 'pointer', fontWeight: '500', color: genreFilter === g ? '#F43F5E' : '#9CA3AF', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {g}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedSeries && (
                <button onClick={() => setSelectedSeries(null)} style={{ padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#F3F4F6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                  Return
                </button>
              )}
              <button 
                onClick={handleBrowse} disabled={isScanning}
                style={{ padding: '12px 24px', background: isScanning ? '#374151' : 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: isScanning ? 'not-allowed' : 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: isScanning ? 'none' : '0 4px 15px rgba(244, 63, 94, 0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                {isScanning ? 'Scanning...' : 'Scan Directory'}
              </button>
            </div>
          </div>

          {/* CONTINUE WATCHING WIDGETS */}
          {!selectedSeries && currentView === 'library' && nextUpList.length > 0 && !genreFilter && !searchQuery && (
            <div style={{ marginBottom: '45px' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#10B981', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                <span style={{ fontSize: '1.5rem' }}>▶</span> CONTINUE WATCHING
              </h3>
              
              <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '15px' }}>
                {nextUpList.map(({ series, episode }) => (
                  <div 
                    key={series.id}
                    onClick={() => setSelectedSeries(series)}
                    style={{ minWidth: '320px', flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '15px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', backdropFilter: 'blur(5px)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ width: '60px', height: '85px', borderRadius: '6px', backgroundImage: series.poster_url ? `url(${series.poster_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}></div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: '#10B981', fontWeight: '800', fontSize: '0.75rem', letterSpacing: '1px', marginBottom: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {series.title.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#F9FAFB' }}>
                        S{episode.season} - E{episode.episode}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GRID VIEW */}
          {!selectedSeries && currentView !== 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '35px' }}>
              {displayedLibrary.map((series) => {
                const totalEps = series.episodes.length;
                const watchedEps = series.episodes.filter(e => e.is_watched === 1).length;
                const progressPct = totalEps > 0 ? (watchedEps / totalEps) * 100 : 0;

                return (
                  <div key={series.id} onClick={() => setSelectedSeries(series)} style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                    
                    {series.is_favorite === 1 && (
                      <div style={{ position: 'absolute', top: 10, right: 10, color: '#F43F5E', fontSize: '1.5rem', zIndex: 10, textShadow: '0 2px 5px rgba(0,0,0,0.8)' }}>♥</div>
                    )}

                    <div style={{ height: '320px', backgroundColor: '#0B0F19', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {series.mal_id === null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                          <div style={{ width: '50px', height: '4px', backgroundColor: '#F43F5E', animation: 'pulse 1s infinite' }}></div>
                        </div>
                      ) : series.poster_url ? (
                        <img src={series.poster_url} alt={series.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : <span style={{ fontWeight: '700' }}>NO COVER</span>}
                    </div>

                    <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#10B981', transition: 'width 0.3s' }}></div>
                    </div>

                    <div style={{ padding: '18px' }}>
                      <div style={{ fontWeight: '700', fontSize: '1.05rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{series.title}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* SETTINGS VIEW */}
          {!selectedSeries && currentView === 'settings' && (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Current Root Directory</h3>
                <p style={{ color: '#9CA3AF', margin: '0 0 15px 0', fontSize: '0.9rem' }}>{folderPath || 'No directory selected.'}</p>
                <button onClick={handleBrowse} style={{ padding: '10px 20px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Change Root Directory</button>
              </div>

              <div style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#F59E0B' }}>Clean Library</h3>
                <p style={{ color: '#9CA3AF', margin: '0 0 15px 0', fontSize: '0.9rem' }}>Scans the database and removes entries for files that have been deleted or moved from your hard drive.</p>
                <button onClick={handleCleanLibrary} style={{ padding: '10px 20px', backgroundColor: '#B45309', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Run Cleanup</button>
              </div>

              <div style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#F43F5E' }}>Nuclear Reset</h3>
                <p style={{ color: '#9CA3AF', margin: '0 0 15px 0', fontSize: '0.9rem' }}>Wipe all metadata, ratings, and watch history. This cannot be undone.</p>
                <button onClick={handleNukeDatabase} style={{ padding: '10px 20px', backgroundColor: '#BE123C', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Nuke Database</button>
              </div>
            </div>
          )}

          {/* SERIES DETAILED VIEW */}
          {selectedSeries && (
             <div>
             <div style={{ display: 'flex', gap: '30px', marginBottom: '50px', backgroundColor: 'rgba(17, 24, 39, 0.6)', padding: '35px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', flexWrap: 'wrap' }}>
               {selectedSeries.poster_url && (
                 <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${selectedSeries.poster_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, filter: 'blur(30px)', zIndex: 0 }}></div>
               )}
               
               {selectedSeries.mal_id === null ? (
                  <div style={{ width: '200px', height: '280px', backgroundColor: '#0B0F19', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}><div style={{ width: '40px', height: '4px', backgroundColor: '#F43F5E', animation: 'pulse 1s infinite' }}></div></div>
               ) : selectedSeries.poster_url ? (
                 <img src={selectedSeries.poster_url} alt="Poster" style={{ width: '200px', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 1, flexShrink: 0, objectFit: 'cover' }} />
               ) : <div style={{ width: '200px', height: '280px', backgroundColor: '#0B0F19', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>NO COVER</div>}

               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 1, minWidth: '300px' }}>
                 
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                   <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                     <span style={{ background: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)', color: 'white', padding: '6px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem' }}>MAL SCORE: {selectedSeries.score || 'N/A'}</span>
                     <span style={{ color: '#E5E7EB', fontWeight: '700', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '6px' }}>{selectedSeries.genres?.toUpperCase() || 'PENDING...'}</span>
                   </div>
                   
                   <button 
                     onClick={() => handleToggleFavorite(selectedSeries.id)} 
                     style={{ background: 'none', border: 'none', fontSize: '2rem', color: selectedSeries.is_favorite ? '#F43F5E' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }}
                   >
                     {selectedSeries.is_favorite ? '♥' : '♡'}
                   </button>
                 </div>

                 <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                   <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#9CA3AF', marginRight: '10px' }}>MY RATING:</span>
                   {[1,2,3,4,5,6,7,8,9,10].map(star => (
                     <span 
                       key={star} 
                       className="star-hover"
                       onClick={() => handleRateSeries(selectedSeries.id, star)}
                       style={{ cursor: 'pointer', fontSize: '1.2rem', color: star <= selectedSeries.user_rating ? '#F59E0B' : 'rgba(255,255,255,0.2)', transition: 'all 0.1s' }}
                     >
                       ★
                     </span>
                   ))}
                   {selectedSeries.user_rating > 0 && (
                      <span onClick={() => handleRateSeries(selectedSeries.id, 0)} style={{ marginLeft: '10px', fontSize: '0.7rem', color: '#6B7280', cursor: 'pointer', fontWeight: 'bold' }}>[CLEAR]</span>
                   )}
                 </div>

                 <p style={{ color: '#D1D5DB', lineHeight: '1.8', fontSize: '1.05rem', overflowY: 'auto', maxHeight: '140px', paddingRight: '15px', marginTop: '10px' }}>
                   {selectedSeries.synopsis || 'Waiting for metadata...'}
                 </p>
               </div>
             </div>

             <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '30px', fontSize: '1.5rem', color: '#F9FAFB', fontWeight: '800' }}>
               <span style={{ color: '#F43F5E' }}>//</span> EPISODES
             </h3>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px' }}>
               {selectedSeries.episodes.map((ep) => (
                 <div key={ep.id} style={{ backgroundColor: 'rgba(17, 24, 39, 0.6)', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${ep.is_watched ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.2s', opacity: ep.is_watched ? 0.6 : 1, position: 'relative' }}>
                   
                   <div 
                     onClick={(e) => handleToggleWatched(ep, selectedSeries, e)}
                     style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: ep.is_watched ? '#10B981' : 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, border: '2px solid rgba(255,255,255,0.2)', transition: 'all 0.2s' }}
                     onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                     onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                   >
                     {ep.is_watched === 1 && <span style={{ color: 'white', fontWeight: 'bold' }}>✓</span>}
                   </div>

                   <div 
                     onClick={(e) => { e.stopPropagation(); window.api.playVideo(ep.file_path); }}
                     style={{ height: '110px', backgroundColor: '#111827', backgroundImage: selectedSeries.poster_url ? `url(${selectedSeries.poster_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center 20%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid #1F2937', cursor: 'pointer' }}
                   >
                     <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.5), rgba(17, 24, 39, 0.95))' }}></div>
                     <span style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '2px', color: 'rgba(255,255,255,0.8)', zIndex: 1 }}>▶ PLAY</span>
                   </div>

                   <div style={{ padding: '18px' }}>
                     <div style={{ fontSize: '0.75rem', color: ep.season === '01' ? '#9CA3AF' : '#F43F5E', marginBottom: '8px', fontWeight: '800', letterSpacing: '1.5px' }}>SEASON {ep.season}</div>
                     <div style={{ fontWeight: '800', fontSize: '1.3rem', color: ep.is_watched ? '#9CA3AF' : '#F3F4F6' }}>Episode {ep.episode}</div>
                     <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '6px', fontWeight: '500' }}>{ep.episode_title || 'Bonus'}</div>
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