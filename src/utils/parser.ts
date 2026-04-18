export interface ParsedAnime {
  original: string
  title: string
  season: string
  episode: string
}

export function parseFilename(filename: string): ParsedAnime {
  const original = filename
  let name = filename

  //STEP 1:SANITIZATION
  //Remove technical clutter
  name = name.replace(/[\[\(].*?[\]\)]/g, '') //Remove [Hash] and (Source)
  name = name.replace(/\b(1080p|720p|480p|2160p|4k)\b/gi, '') 
  name = name.replace(/\b(x264|x265|hevc|10bit|8bit)\b/gi, '') 
  name = name.replace(/\.[^/.]+$/, '') //Remove extension
  name = name.replace(/_/g, ' ') //Underscores to spaces
  name = name.trim()

  let title = name
  let season = '01'
  let episode = '??'

  //STEP 2:PATTERN MATCHING
  //Pattern A: "Season 2 - 05.5"
  const regexSeason = /Season\s+(\d+).*?(?:Episode\s+|-\s+)(\d+(?:\.\d+)?)/i
  //Pattern B: "S02E05"
  const regexStandard = /S(\d+)\s*E(\d+(?:\.\d+)?)/i
  //Pattern C: " - 05" (Dash followed by number)
  const regexDash = /\s-\s(\d+(?:\.\d+)?)/
  //Pattern D: "Episode 5"
  const regexEpisode = /Episode\s+(\d+(?:\.\d+)?)/i
  
  //Pattern E: SPECIALS (Bonus, OVA, etc.)
  const regexSpecial = /[- ]\s*(Bonus|OVA|Special|OAD|Movie|Extra|Omake|Recap)/i

  const matchSeason = name.match(regexSeason)
  const matchStandard = name.match(regexStandard)
  const matchDash = name.match(regexDash)
  const matchEpisode = name.match(regexEpisode)
  const matchSpecial = name.match(regexSpecial)

  if (matchSeason) {
    season = matchSeason[1].padStart(2, '0')
    episode = matchSeason[2]
    title = name.substring(0, matchSeason.index).trim()
  } 
  else if (matchStandard) {
    season = matchStandard[1].padStart(2, '0')
    episode = matchStandard[2]
    title = name.substring(0, matchStandard.index).trim()
  } 
  else if (matchDash) {
    episode = matchDash[1]
    title = name.substring(0, matchDash.index).trim()
  }
  else if (matchEpisode) {
    episode = matchEpisode[1]
    title = name.substring(0, matchEpisode.index).trim()
  }
  else if (matchSpecial) {
    // Found a Special Episode Keyword!
    episode = matchSpecial[1] 
    title = name.substring(0, matchSpecial.index).trim()
  }
  else {
    //STEP 3:THE FAIL-SAFE (Dash Fallback)
    //If no numbers or keywords found, but there is a " - ", split there!
    //Example: "Monster - The Ending" -> Title: "Monster", Ep: "The Ending"
    const dashIndex = name.indexOf(' - ')
    if (dashIndex !== -1) {
       title = name.substring(0, dashIndex).trim()
       //+3 skips " - "
       episode = name.substring(dashIndex + 3).trim()
    }
  }

  //STEP 4:CLEANUP
  // Only pad numeric episodes (integers only)
  if (!isNaN(parseFloat(episode))) {
    if (!episode.includes('.')) {
      episode = episode.padStart(2, '0')
    }
  }

  // Remove trailing dashes or dots from title
  title = title.replace(/[-.]$/, '').trim()
  title = title.replace(/\./g, ' ').trim()

  if (!title) title = name

  return { original, title, season, episode }
}