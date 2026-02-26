const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

console.log(`🔑 OMDB API Key: ${OMDB_API_KEY ? '✓ Loaded' : '✗ Not found'}`);
console.log(`🎬 TMDb API Key: ${TMDB_API_KEY ? '✓ Loaded' : '✗ Not found'}`);
console.log(`🤖 HuggingFace API Key: ${HUGGINGFACE_API_KEY ? '✓ Loaded' : '✗ Not found'}`);

// Poster cache to avoid repeated API calls
const posterCache = {};
let cachedTMDbFilms = null;
let tmdbCacheTime = 0;
const TMDB_CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json());

// Function to fetch films from TMDb
async function fetchTMDbPopularFilms() {
    // Return cached films if within cache duration
    if (cachedTMDbFilms && Date.now() - tmdbCacheTime < TMDB_CACHE_DURATION) {
        return cachedTMDbFilms;
    }

    if (!TMDB_API_KEY) {
        console.warn('No TMDb API key found');
        return [];
    }

    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/popular', {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            },
            timeout: 5000
        });

        const tmdbFilms = (response.data.results || [])
            .filter(film => film.poster_path && film.release_date)
            .slice(0, 20) // Get top 20 popular films
            .map(film => ({
                title: film.title,
                description: film.overview || 'A compelling film from TMDb.',
                year: parseInt(film.release_date.split('-')[0]),
                director: 'Various',
                poster: `https://image.tmdb.org/t/p/w300${film.poster_path}`,
                source: 'tmdb',
                // Tag films based on popularity/rating to fit mood scoring
                tags: film.vote_average > 7 ? ['challenge'] : film.vote_average > 6 ? ['comfort'] : ['light'],
                _tmdbId: film.id
            }));

        cachedTMDbFilms = tmdbFilms;
        tmdbCacheTime = Date.now();
        console.log(`✓ Fetched ${tmdbFilms.length} films from TMDb`);
        return tmdbFilms;
    } catch (error) {
        console.warn('TMDb fetch error:', error.message);
        return [];
    }
}

// Function to fetch poster from OMDB
async function fetchPosterFromOMDB(title, year) {
    if (!OMDB_API_KEY) {
        console.warn('No OMDB API key found in environment');
        return `https://via.placeholder.com/300x450?text=${encodeURIComponent(title)}`;
    }

    const cacheKey = `${title}-${year}`;
    if (posterCache[cacheKey]) {
        return posterCache[cacheKey];
    }

    try {
        const response = await axios.get('https://www.omdbapi.com/', {
            params: {
                apikey: OMDB_API_KEY,
                t: title,
                y: year,
                type: 'movie'
            },
            timeout: 5000
        });

        let poster = `https://via.placeholder.com/300x450?text=${encodeURIComponent(title)}`;
        
        if (response.data && response.data.Poster && response.data.Poster !== 'N/A') {
            // Use IMDb image directly (more reliable than Amazon)
            poster = response.data.Poster;
            console.log(`✓ Poster: ${title}`);
        }

        posterCache[cacheKey] = poster;
        return poster;
    } catch (error) {
        console.warn(`✗ Poster error for ${title}:`, error.message);
        return `https://via.placeholder.com/300x450?text=${encodeURIComponent(title)}`;
    }
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate mood description endpoint
// Generate AI mood analysis using Hugging Face API
async function generateAIMoodDescription(mood) {
    // Fallback descriptions in case API fails
    const fallbackDescriptions = [
        "Your vibe calls for cinema that understands you—something that bends reality just enough to make the ordinary extraordinary.",
        "Tonight you're seeking the kind of story that mirrors the way you feel: intimate, haunting, and yet somehow perfect.",
        "Your mood speaks to films that don't just entertain, but transform the way you see the world.",
        "This is a moment for cinema that feels like a conversation between your heart and the screen.",
        "You're looking for something that moves at the rhythm of your thoughts—unpredictable, immersive, unforgettable."
    ];

    if (!HUGGINGFACE_API_KEY) {
        return fallbackDescriptions[Math.floor(Math.random() * fallbackDescriptions.length)];
    }

    try {
        const moodString = `Weight: ${mood.weight}/100 (emotional intensity), Pace: ${mood.pace}/100 (fast), Comfort: ${mood.comfort}/100 (challenge vs comfort), Reality: ${mood.reality}/100 (dreamlike), Era: ${mood.era}/100 (modern), Social: ${mood.social}/100 (group), Tone: ${mood.tone}/100 (uplifting), Dialogue: ${mood.dialogue}/100 (verbose)`;
        
        const prompt = `Based on this mood profile: ${moodString}. Generate a single, poetic sentence (under 20 words) describing the perfect film experience for someone with this exact mood. Be personal, artistic, and evocative. No preamble, just the sentence.`;

        const response = await axios.post(
            'https://api-inference.huggingface.co/models/gpt2',
            { inputs: prompt, parameters: { max_new_tokens: 50 } },
            {
                headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
                timeout: 5000
            }
        );

        if (response.data && response.data[0] && response.data[0].generated_text) {
            const text = response.data[0].generated_text;
            // Extract the generated part (after the prompt)
            const generatedPart = text.split(prompt).pop().trim();
            return generatedPart || fallbackDescriptions[Math.floor(Math.random() * fallbackDescriptions.length)];
        }

        return fallbackDescriptions[Math.floor(Math.random() * fallbackDescriptions.length)];
    } catch (error) {
        console.warn('HuggingFace API error:', error.message);
        return fallbackDescriptions[Math.floor(Math.random() * fallbackDescriptions.length)];
    }
}

app.post('/api/mood-description', async (req, res) => {
    try {
        const { mood } = req.body;

        if (!mood) {
            return res.status(400).json({ error: 'Mood data is required' });
        }

        // Try to get AI-generated description
        const description = await generateAIMoodDescription(mood);

        res.json({ description, success: true });
    } catch (error) {
        console.error('Error:', error);
        res.json({ 
            description: 'Your mood speaks to cinema that understands you—something truly special awaits.', 
            fallback: true 
        });
    }
});

// Film generation endpoint
app.post('/api/generate-films', async (req, res) => {
    try {
        const { mood, hasImage } = req.body;

        if (!mood) {
            return res.status(400).json({ error: 'Mood data is required' });
        }

        // Generate film suggestions based on mood
        const films = await generateFilmSuggestions(mood);

        res.json({ films, success: true });
    } catch (error) {
        console.error('Error:', error);
        res.json({ films: await getDefaultFilms(), fallback: true });
    }
});

// Generate film suggestions based on mood dimensions
async function generateFilmSuggestions(mood) {
    const filmDatabase = [
        // Light & Comfort
        { title: 'Amélie', description: 'Whimsy and magic in ordinary Parisian moments.', year: 2001, director: 'Jean-Pierre Jeunet', dimensions: { weight: 20, pace: 50, comfort: 85, reality: 30, era: 80, social: 70, tone: 90, dialogue: 75 } },
        { title: 'The Grand Budapest Hotel', description: 'A beautifully composed pastiche of elegance and melancholy.', year: 2014, director: 'Wes Anderson', dimensions: { weight: 35, pace: 45, comfort: 75, reality: 40, era: 50, social: 70, tone: 75, dialogue: 80 } },
        { title: 'Paddington 2', description: 'Pure-hearted adventure wrapped in British charm.', year: 2017, director: 'Paul King', dimensions: { weight: 15, pace: 65, comfort: 90, reality: 35, era: 80, social: 85, tone: 95, dialogue: 85 } },
        
        // Heavy & Challenge
        { title: 'Requiem for a Dream', description: 'Descent into addiction rendered with visceral poetry.', year: 2000, director: 'Darren Aronofsky', dimensions: { weight: 95, pace: 85, comfort: 10, reality: 70, era: 70, social: 20, tone: 10, dialogue: 25 } },
        { title: 'Come and See', description: 'War through the eyes of a boy—devastating and unforgettable.', year: 1985, director: 'Elem Klimov', dimensions: { weight: 100, pace: 90, comfort: 5, reality: 90, era: 20, social: 40, tone: 5, dialogue: 20 } },
        { title: 'Synecdoche, New York', description: 'Reality collapses into art in this labyrinthine meditation.', year: 2008, director: 'Charlie Kaufman', dimensions: { weight: 85, pace: 40, comfort: 20, reality: 40, era: 80, social: 60, tone: 25, dialogue: 90 } },
        
        // Slow Burn
        { title: 'Stalker', description: 'A meditative journey through emotion and existential wonder.', year: 1979, director: 'Andrei Tarkovsky', dimensions: { weight: 65, pace: 15, comfort: 40, reality: 50, era: 20, social: 30, tone: 50, dialogue: 30 } },
        { title: 'In the Mood for Love', description: 'Repressed desire blooms through frames of saturated color.', year: 2000, director: 'Wong Kar-wai', dimensions: { weight: 50, pace: 20, comfort: 60, reality: 30, era: 70, social: 35, tone: 70, dialogue: 25 } },
        { title: 'Tokyo Story', description: 'Profound humanity emerges from quiet domestic moments.', year: 1953, director: 'Yasujirō Ozu', dimensions: { weight: 55, pace: 10, comfort: 65, reality: 95, era: 5, social: 75, tone: 75, dialogue: 70 } },
        
        // Fast Paced
        { title: 'Parasite', description: 'Class warfare explodes with dark comic energy and precision.', year: 2019, director: 'Bong Joon-ho', dimensions: { weight: 75, pace: 85, comfort: 30, reality: 80, era: 90, social: 90, tone: 45, dialogue: 85 } },
        { title: 'Mad Max: Fury Road', description: 'Pure kinetic poetry—a two-hour chase driven by visual perfection.', year: 2015, director: 'George Miller', dimensions: { weight: 70, pace: 95, comfort: 20, reality: 40, era: 80, social: 60, tone: 35, dialogue: 15 } },
        { title: 'Terminator 2', description: 'Action elevated to art through innovation and precision.', year: 1991, director: 'James Cameron', dimensions: { weight: 65, pace: 90, comfort: 25, reality: 45, era: 70, social: 40, tone: 30, dialogue: 50 } },
        
        // Dreamlike
        { title: 'Mulholland Drive', description: 'Dreams collapse into deception in this shimmering fever dream.', year: 2001, director: 'David Lynch', dimensions: { weight: 80, pace: 50, comfort: 15, reality: 20, era: 75, social: 25, tone: 20, dialogue: 40 } },
        { title: 'Pan\'s Labyrinth', description: 'Myth and fascism collide in a haunting visual fantasia.', year: 2006, director: 'Guillermo del Toro', dimensions: { weight: 75, pace: 60, comfort: 30, reality: 25, era: 70, social: 45, tone: 30, dialogue: 50 } },
        { title: 'The Fountain', description: 'Three eras of love and loss rendered in visual wonder.', year: 2006, director: 'Darren Aronofsky', dimensions: { weight: 80, pace: 45, comfort: 35, reality: 25, era: 60, social: 20, tone: 50, dialogue: 25 } },
        
        // Real & Contemporary
        { title: 'Before Sunrise', description: 'Two strangers discover connection through language and presence.', year: 1995, director: 'Richard Linklater', dimensions: { weight: 40, pace: 25, comfort: 70, reality: 95, era: 60, social: 85, tone: 85, dialogue: 95 } },
        { title: 'Boyhood', description: 'Twelve years of life captured with intimate authenticity.', year: 2014, director: 'Richard Linklater', dimensions: { weight: 50, pace: 20, comfort: 70, reality: 95, era: 90, social: 80, tone: 75, dialogue: 85 } },
        { title: 'Moonlight', description: 'Three moments in a life rendered with poetic grace.', year: 2016, director: 'Barry Jenkins', dimensions: { weight: 60, pace: 25, comfort: 65, reality: 85, era: 85, social: 50, tone: 70, dialogue: 35 } },
        
        // Classic
        { title: 'The Seventh Seal', description: 'A knight confronts mortality with quiet philosophical grace.', year: 1957, director: 'Ingmar Bergman', dimensions: { weight: 70, pace: 20, comfort: 30, reality: 70, era: 5, social: 50, tone: 40, dialogue: 80 } },
        { title: 'Vertigo', description: 'Obsession rendered as visual mastery and psychological torment.', year: 1958, director: 'Alfred Hitchcock', dimensions: { weight: 75, pace: 60, comfort: 20, reality: 60, era: 5, social: 30, tone: 25, dialogue: 60 } },
        { title: 'Casablanca', description: 'Sacrifice and romance amid wartime intrigue.', year: 1942, director: 'Michael Curtiz', dimensions: { weight: 65, pace: 55, comfort: 40, reality: 60, era: 5, social: 85, tone: 60, dialogue: 90 } },
        
        // Social
        { title: 'Chungking Express', description: 'Chance encounters blossom into unexpected romance.', year: 1994, director: 'Wong Kar-wai', dimensions: { weight: 40, pace: 55, comfort: 70, reality: 35, era: 60, social: 80, tone: 80, dialogue: 25 } },
        { title: 'Memories of Murder', description: 'A procedural spiral into darkness and moral ambiguity.', year: 2003, director: 'Bong Joon-ho', dimensions: { weight: 80, pace: 70, comfort: 25, reality: 85, era: 75, social: 75, tone: 30, dialogue: 85 } },
        { title: 'La La Land', description: 'Romance and ambition dance through a modern city.', year: 2016, director: 'Damien Chazelle', dimensions: { weight: 45, pace: 65, comfort: 75, reality: 50, era: 90, social: 85, tone: 85, dialogue: 80 } },
        
        // Additional titles for more diversity
        { title: 'Blade Runner 2049', description: 'Neo-noir meditation on memory and humanity in a decaying future.', year: 2017, director: 'Denis Villeneuve', dimensions: { weight: 65, pace: 40, comfort: 20, reality: 35, era: 90, social: 20, tone: 35, dialogue: 20 } },
        { title: 'Eternal Sunshine of the Spotless Mind', description: 'A journey through memory erasing love and loss.', year: 2004, director: 'Michel Gondry', dimensions: { weight: 65, pace: 50, comfort: 50, reality: 40, era: 80, social: 40, tone: 60, dialogue: 75 } },
        { title: 'Spirited Away', description: 'A girl navigates a magical bathhouse in this animated masterpiece.', year: 2001, director: 'Hayao Miyazaki', dimensions: { weight: 50, pace: 70, comfort: 60, reality: 20, era: 70, social: 70, tone: 75, dialogue: 70 } },
        { title: 'Inception', description: 'A heist into the architecture of dreams and the subconscious.', year: 2010, director: 'Christopher Nolan', dimensions: { weight: 65, pace: 85, comfort: 40, reality: 35, era: 85, social: 60, tone: 60, dialogue: 80 } },
        { title: 'The Lighthouse', description: 'Two men descend into madness in isolation on a rocky island.', year: 2019, director: 'Robert Eggers', dimensions: { weight: 85, pace: 50, comfort: 10, reality: 50, era: 15, social: 10, tone: 20, dialogue: 75 } },
        { title: 'Good as It Gets', description: 'A curmudgeon finds unexpected connections and warmth.', year: 1997, director: 'James L. Brooks', dimensions: { weight: 35, pace: 55, comfort: 70, reality: 75, era: 70, social: 85, tone: 80, dialogue: 90 } }
    ];

    // Merge with TMDb films for expanded library
    const tmdbFilms = await fetchTMDbPopularFilms();
    const mergedDatabase = [...filmDatabase, ...tmdbFilms];

    // Score films based on mood match with continuous scaling
    const scoredFilms = mergedDatabase.map(film => {
        let score = 0;

        if (film.dimensions) {
            // Direct dimensional matching with smooth scaling
            const dims = film.dimensions;
            const moodValues = [mood.weight, mood.pace, mood.comfort, mood.reality, mood.era, mood.social, mood.tone, mood.dialogue];
            const filmValues = [dims.weight, dims.pace, dims.comfort, dims.reality, dims.era, dims.social, dims.tone, dims.dialogue];
            
            // Calculate Euclidean distance for overall mood compatibility
            let distanceScore = 0;
            for (let i = 0; i < moodValues.length; i++) {
                const diff = Math.abs(moodValues[i] - filmValues[i]);
                // Smoother scoring: closer = higher score (100 - diff)
                distanceScore += (100 - diff) / 8; // Normalize by dividing by number of dimensions
            }
            
            score += distanceScore * 1.5; // Weight dimensional matching heavily
        } else if (film.tags) {
            // Fallback to tag-based scoring for TMDb films
            // Weight: light (0-40) vs heavy (60-100)
            if (film.tags.includes('light')) {
                score += Math.max(0, 40 - mood.weight) / 20;
            }
            if (film.tags.includes('heavy')) {
                score += Math.max(0, mood.weight - 60) / 20;
            }

            // Pace: slow (0-40) vs fast (60-100)
            if (film.tags.includes('slow')) {
                score += Math.max(0, 40 - mood.pace) / 20;
            }
            if (film.tags.includes('fast')) {
                score += Math.max(0, mood.pace - 60) / 20;
            }

            // Comfort: challenge (0-40) vs light/comfort (60-100)
            if (film.tags.includes('challenge')) {
                score += Math.max(0, 40 - mood.comfort) / 20;
            }
            if (film.tags.includes('light')) {
                score += Math.max(0, mood.comfort - 60) / 20;
            }

            // Reality: dreamlike (0-40) vs real (60-100)
            if (film.tags.includes('dreamlike')) {
                score += Math.max(0, 40 - mood.reality) / 20;
            }
            if (film.tags.includes('real')) {
                score += Math.max(0, mood.reality - 60) / 20;
            }

            // Era: classic (0-40) vs contemporary (60-100)
            if (film.tags.includes('classic')) {
                score += Math.max(0, 40 - mood.era) / 20;
            }
            if (film.tags.includes('contemporary')) {
                score += Math.max(0, mood.era - 60) / 20;
            }

            // Social: solo (0-40) vs social (60-100)
            if (film.tags.includes('solo')) {
                score += Math.max(0, 40 - mood.social) / 20;
            }
            if (film.tags.includes('social')) {
                score += Math.max(0, mood.social - 60) / 20;
            }

            // Tone: dark (0-40) vs uplifting (60-100)
            if (film.tags.includes('dark')) {
                score += Math.max(0, 40 - mood.tone) / 20;
            }
            if (film.tags.includes('uplifting')) {
                score += Math.max(0, mood.tone - 60) / 20;
            }

            // Dialogue: minimal (0-40) vs talkative (60-100)
            if (film.tags.includes('visual')) {
                score += Math.max(0, 40 - mood.dialogue) / 20;
            }
            if (film.tags.includes('talkative')) {
                score += Math.max(0, mood.dialogue - 60) / 20;
            }
        }

        // Add larger random variance based on mood entropy for more diversity
        // More extreme moods get less randomness (more focused results)
        const moodEntropy = (Math.abs(mood.weight - 50) + Math.abs(mood.pace - 50) + Math.abs(mood.comfort - 50) + Math.abs(mood.reality - 50) + Math.abs(mood.era - 50) + Math.abs(mood.social - 50) + Math.abs(mood.tone - 50) + Math.abs(mood.dialogue - 50)) / 8;
        const randomVariance = (100 - moodEntropy) * 0.08; // Up to 8 points of randomness
        score += Math.random() * randomVariance;

        return { ...film, score };
    });

    // Sort by score and return top 8 with diversity weighting
    const topFilms = scoredFilms
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ score, tags, dimensions, ...film }) => film);

    // Fetch posters for all returned films
    const filmsWithPosters = await Promise.all(
        topFilms.map(async (film) => {
            // If film has a TMDb poster URL, use it directly; otherwise fetch from OMDB
            if (film.poster && film.source === 'tmdb') {
                return { ...film };
            }
            const poster = await fetchPosterFromOMDB(film.title, film.year);
            return { ...film, poster };
        })
    );

    return filmsWithPosters;
}

async function getDefaultFilms() {
    const defaultFilms = [
        { title: 'Stalker', description: 'A meditative journey through emotion and existential wonder.', year: 1979, director: 'Andrei Tarkovsky' },
        { title: 'Mulholland Drive', description: 'Dreams collapse into deception in this shimmering fever dream.', year: 2001, director: 'David Lynch' },
        { title: 'Before Sunrise', description: 'Two strangers discover connection through language and presence.', year: 1995, director: 'Richard Linklater' },
        { title: 'The Seventh Seal', description: 'A knight confronts mortality with quiet philosophical grace.', year: 1957, director: 'Ingmar Bergman' },
        { title: 'Chungking Express', description: 'Chance encounters blossom into unexpected romance.', year: 1994, director: 'Wong Kar-wai' },
        { title: 'Memories of Murder', description: 'A procedural spiral into darkness and moral ambiguity.', year: 2003, director: 'Bong Joon-ho' },
        { title: 'Amélie', description: 'Whimsy and magic in ordinary Parisian moments.', year: 2001, director: 'Jean-Pierre Jeunet' },
        { title: 'The Grand Budapest Hotel', description: 'A beautifully composed pastiche of elegance and melancholy.', year: 2014, director: 'Wes Anderson' }
    ];

    // Fetch posters for all default films
    const filmsWithPosters = await Promise.all(
        defaultFilms.map(async (film) => {
            const poster = await fetchPosterFromOMDB(film.title, film.year);
            return { ...film, poster };
        })
    );

    return filmsWithPosters;
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎬 Cinema Backend running on port ${PORT}`);
    console.log(`📍 Frontend: ${FRONTEND_URL}`);
    console.log(`🔧 Mode: ${NODE_ENV}\n`);
});
