import { updateSeriesMetadata, updateEpisodeTitle } from './database'
import { Buffer } from 'node:buffer'

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const sanitize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, '')

export async function fetchAnimeMetadata(seriesId: number, searchTitle: string, parsedTitle: string, seasonInt: number) {
  try {
    
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=10`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429) {
        console.log(`Rate limited on ${searchTitle}! Waiting 2 seconds...`)
        await delay(2000)
        return fetchAnimeMetadata(seriesId, searchTitle, parsedTitle, seasonInt) 
      }
      console.error(`Jikan API Error: ${response.status}. Skipping metadata for ${searchTitle}.`)
      return; 
    }

    const data = await response.json()

    if (data.data && data.data.length > 0) {
      
      let bestMatch = data.data[0] 
      let highestScore = -9999 

      const searchBaseSanitized = sanitize(parsedTitle)
      const fullSearchSanitized = sanitize(searchTitle)

      data.data.forEach((item: any, index: number) => {
        let score = 0
        
        const titles = [
          item.title,
          item.title_english,
          ...(item.title_synonyms || [])
        ].filter(Boolean).map(t => t.toLowerCase())

        const sanitizedTitles = titles.map(sanitize)

        if (sanitizedTitles.includes(fullSearchSanitized)) {
            score += 2000 
        } else if (sanitizedTitles.some(t => t.includes(searchBaseSanitized))) {
            score += 100 
        }

        const type = item.type || ""
        if (type === "TV") score += 200
        if (type === "Movie") score += 50
        if (type === "Music" || type === "CM" || type === "PV" || type === "Special" || type === "ONA") {
            score -= 800 
        }

        if (seasonInt > 1) {
            
            const isExactBase = sanitizedTitles.includes(searchBaseSanitized)
            if (isExactBase) {
                score -= 1000 
            }

            if (!isExactBase && sanitizedTitles.some(t => t.includes(searchBaseSanitized))) {
                score += 400 
            }

            const roman = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][seasonInt] || ""
            const seasonMarkers = [
                `season ${seasonInt}`, `${seasonInt}nd season`, `${seasonInt}rd season`, `${seasonInt}th season`,
                `part ${seasonInt}`, `season ${roman}`
            ]
            if (titles.some(t => seasonMarkers.some(m => t.includes(m)))) {
                score += 1000
            }

            const wrongSeasonRegex = new RegExp(`\\b(season [1-9]|part [1-9]|[1-9]nd|[1-9]rd|[1-9]th)\\b`, 'i')
            const hasWrongSeason = titles.some(t => {
                const match = t.match(wrongSeasonRegex)
                return match ? !match[0].includes(seasonInt.toString()) : false
            })
            if (hasWrongSeason) {
                score -= 1000
            }

        } else {
            const wrongSeasonRegex = /\b(season [2-9]|part [2-9]|2nd|3rd|4th|5th|6th)\b/i
            if (titles.some(t => wrongSeasonRegex.test(t))) {
                score -= 1000
            }
        }

        score += (10 - index) * 10 
        
        if (seasonInt > 1 && item.year) {
            score += (item.year - 2000) * 50
        }

        if (seasonInt > 1) {
            score += (item.members || 0) / 1000000 
        } else {
            score += (item.members || 0) / 100000
        }

        if (score > highestScore) {
            highestScore = score
            bestMatch = item
        }
      })

      const mal_id = bestMatch.mal_id
      const targetImageUrl = bestMatch.images?.jpg?.large_image_url || bestMatch.images?.jpg?.image_url || ''
      let offlinePosterBase64 = ''

      if (targetImageUrl) {
        try {
          const imgResponse = await fetch(targetImageUrl)
          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            offlinePosterBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`
          }
        } catch (imgError) {
          console.error(`Failed to download poster for ${bestMatch.title}:`, imgError)
        }
      }

      const metadata = {
        mal_id: mal_id,
        poster_url: offlinePosterBase64,
        synopsis: bestMatch.synopsis || 'No synopsis available.',
        genres: bestMatch.genres ? bestMatch.genres.map((g: any) => g.name).join(', ') : '',
        score: bestMatch.score || 0
      }

      updateSeriesMetadata(seriesId, metadata)

      await delay(1500) 
      const epUrl = `https://api.jikan.moe/v4/anime/${mal_id}/episodes`
      const epResponse = await fetch(epUrl)
      
      if (epResponse.ok) {
        const epData = await epResponse.json()
        if (epData.data) {
          for (const ep of epData.data) {
            const epNumStr = ep.mal_id.toString().padStart(2, '0')
            updateEpisodeTitle(seriesId, epNumStr, ep.title)
          }
          console.log(`Vault Updated: ${bestMatch.title} (MAL ID: ${mal_id})`)
        }
      }
    } else {
      console.log(`No results found on MyAnimeList for: ${searchTitle}`)
    }
  } catch (error) {
    console.error(`Failed to fetch data for ${searchTitle}:`, error)
  }
}