import { useState, useMemo, useEffect } from 'react'
import { parseFilename, ParsedAnime } from './utils/parser'

function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string>(localStorage.getItem('animeLibraryPath') || '')
  const [animeList, setAnimeList] = useState<ParsedAnime[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)

  const loadLibrary = async (path: string) => {
    try {
      const files = await window.api.scanFiles(path)
      const parsedData = files.map((file) => parseFilename(file))
      setAnimeList(parsedData)
    } catch (error) {
      console.error("Failed to load library:", error)
    }
  }

  useEffect(() => {
    const savedPath = localStorage.getItem('animeLibraryPath')
    if (savedPath) {
      loadLibrary(savedPath)
    }
  }, [])

  const handleBrowse = async () => {
    const path = await window.api.selectFolder()
    if (path) {
      setFolderPath(path)
      localStorage.setItem('animeLibraryPath', path)
      loadLibrary(path)
      setSelectedSeries(null)
    }
  }

  const groupedAnime = useMemo(() => {
    const groups: Record<string, ParsedAnime[]> = {}
    animeList.forEach((anime) => {
      const cleanTitle = anime.title.trim()
      if (!groups[cleanTitle]) groups[cleanTitle] = []
      groups[cleanTitle].push(anime)
    })
    return groups
  }, [animeList])

  const seriesNames = Object.keys(groupedAnime).sort()

  const currentEpisodes = useMemo(() => {
    if (!selectedSeries) return []
    return [...groupedAnime[selectedSeries]].sort((a, b) => {
      const seasonA = parseInt(a.season) || 0
      const seasonB = parseInt(b.season) || 0
      if (seasonA !== seasonB) return seasonA - seasonB

      const numA = parseFloat(a.episode)
      const numB = parseFloat(b.episode)
      const isNumA = !isNaN(numA)
      const isNumB = !isNaN(numB)

      if (isNumA && isNumB) return numA - numB
      if (!isNumA && isNumB) return 1
      if (isNumA && !isNumB) return -1
      return a.episode.localeCompare(b.episode)
    })
  }, [selectedSeries, groupedAnime])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#1e1e1e', color: 'white' }}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', backgroundColor: '#252526', padding: '20px', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#61dafb' }}>OtakuVault</h2>
        <div style={{ padding: '10px', backgroundColor: '#37373d', borderRadius: '5px', cursor: 'pointer' }} onClick={() => setSelectedSeries(null)}>Library</div>
        <div style={{ padding: '10px', cursor: 'pointer', opacity: 0.7 }}>Favorites</div>
        <div style={{ padding: '10px', cursor: 'pointer', opacity: 0.7 }}>Settings</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '20px' }}>
          
          {/* Left Block: Title & Subtitle*/}
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <h1 style={{ margin: '0 0 5px 0', lineHeight: '1.2' }}>
              {selectedSeries ? selectedSeries : 'My Collection'}
            </h1>
            <div style={{ fontSize: '0.9rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {folderPath || 'No folder selected'}
            </div>
          </div>

          {/* Right Block: Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
            {selectedSeries && (
              <button 
                onClick={() => setSelectedSeries(null)}
                style={{ padding: '10px 20px', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            <button 
              onClick={handleBrowse}
              style={{ padding: '10px 20px', backgroundColor: '#007acc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Scan Folder
            </button>
          </div>

        </div>

        {/* VIEW 1: Series List (Folders) */}
        {!selectedSeries && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '25px' }}>
            {seriesNames.map((series) => (
              <div 
                key={series} 
                onClick={() => setSelectedSeries(series)}
                title={series}
                style={{ backgroundColor: '#2d2d30', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
              >
                <div style={{ height: '280px', backgroundColor: '#3e3e42', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', position: 'relative' }}>
                  <span style={{ fontSize: '3rem' }}>📁</span>
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                    {groupedAnime[series].length} Eps
                  </div>
                </div>
                <div style={{ padding: '15px' }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '1.1rem', 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.3'
                  }}>
                    {series}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: Episodes List */}
        {selectedSeries && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
            {currentEpisodes.map((anime, index) => (
              <div key={index} style={{ backgroundColor: '#2d2d30', borderRadius: '8px', overflow: 'hidden' }} title={anime.original}>
                <div style={{ height: '140px', backgroundColor: '#3e3e42', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                  <span style={{ fontSize: '2rem' }}>▶</span>
                </div>
                <div style={{ padding: '15px' }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: anime.season === '01' ? '#61dafb' : '#ff9800', 
                    marginBottom: '4px', 
                    fontWeight: 'bold', 
                    textTransform: 'uppercase' 
                  }}>
                     Season {anime.season}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Episode {anime.episode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App