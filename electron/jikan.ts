import { updateSeriesMetadata, updateEpisodeTitle } from './database'
import { Buffer } from 'node:buffer'

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function fetchAnimeMetadata(seriesId: number, title: string) {
  try {
    console.log(`Fetching metadata for: ${title}...`)
    
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=10`
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 429) {
        console.log(`Rate limited on ${title}! Waiting 2 seconds...`)
        await delay(2000)
        return fetchAnimeMetadata(seriesId, title) 
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.data && data.data.length > 0) {
      let bestMatch = data.data[0] 
      const searchStr = title.toLowerCase().trim()

      // PASS 1: Exact text match (English, Japanese, or Synonym)
      let validMatches = data.data.filter((item: any) => {
        const t1 = (item.title || "").toLowerCase()
        const t2 = (item.title_english || "").toLowerCase()
        const synonyms = (item.title_synonyms || []).map((s: string) => s.toLowerCase())
        return t1 === searchStr || t2 === searchStr || synonyms.includes(searchStr)
      })

      // PASS 2: Substring match
      if (validMatches.length === 0) {
        validMatches = data.data.filter((item: any) => {
          const t1 = (item.title || "").toLowerCase()
          const t2 = (item.title_english || "").toLowerCase()
          return t1.includes(searchStr) || t2.includes(searchStr)
        })
      }

      // Member count
      if (validMatches.length > 0) {
        bestMatch = validMatches.reduce((prev: any, current: any) => {
          return (prev.members > current.members) ? prev : current
        })
      }

      const mal_id = bestMatch.mal_id
      
      const targetImageUrl = bestMatch.images?.jpg?.large_image_url || bestMatch.images?.jpg?.image_url || ''
      let offlinePosterBase64 = ''

      if (targetImageUrl) {
        try {
          console.log(`Downloading poster: ${bestMatch.title}...`)
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
      console.log(`Success: Downloaded and saved data for ${bestMatch.title}`)

      // Fetch Episodes
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
          console.log(`Success: Downloaded episode titles for ${bestMatch.title}`)
        }
      }
    } else {
      console.log(`No results found on MyAnimeList for: ${title}`)
    }
  } catch (error) {
    console.error(`Failed to fetch data for ${title}:`, error)
  }
}