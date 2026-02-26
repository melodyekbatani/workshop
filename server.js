const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const OMDB_API_KEY = process.env.OMDB_API_KEY;

// Poster cache to avoid repeated API calls
const posterCache = {};

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Function to fetch poster from OMDB
async function fetchPosterFromOMDB(title, year) {
    if (!OMDB_API_KEY) {
        return 'https://via.placeholder.com/300x450?text=No+Image';
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

        let poster = 'https://via.placeholder.com/300x450?text=No+Image';
        if (response.data && response.data.Poster && response.data.Poster !== 'N/A') {
            poster = response.data.Poster;
        }

        posterCache[cacheKey] = poster;
        return poster;
    } catch (error) {
        console.warn(`Could not fetch poster for ${title} (${year}):`, error.message);
        return 'https://via.placeholder.com/300x450?text=No+Image';
    }
}

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
        { title: 'Amélie', description: 'Whimsy and magic in ordinary Parisian moments.', year: 2001, director: 'Jean-Pierre Jeunet', tags: ['light', 'comfort', 'contemporary', 'vibrant'] },
        { title: 'The Grand Budapest Hotel', description: 'A beautifully composed pastiche of elegance and melancholy.', year: 2014, director: 'Wes Anderson', tags: ['light', 'comfort', 'contemporary', 'social'] },
        { title: 'Paddington 2', description: 'Pure-hearted adventure wrapped in British charm.', year: 2017, director: 'Paul King', tags: ['light', 'comfort', 'contemporary', 'social'] },
        
        // Heavy & Challenge
        { title: 'Requiem for a Dream', description: 'Descent into addiction rendered with visceral poetry.', year: 2000, director: 'Darren Aronofsky', tags: ['heavy', 'challenge', 'contemporary', 'solo'] },
        { title: 'Come and See', description: 'War through the eyes of a boy—devastating and unforgettable.', year: 1985, director: 'Elem Klimov', tags: ['heavy', 'challenge', 'real'] },
        { title: 'Synecdoche, New York', description: 'Reality collapses into art in this labyrinthine meditation.', year: 2008, director: 'Charlie Kaufman', tags: ['heavy', 'challenge', 'dreamlike', 'contemporary'] },
        
        // Slow Burn
        { title: 'Stalker', description: 'A meditative journey through emotion and existential wonder.', year: 1979, director: 'Andrei Tarkovsky', tags: ['slow', 'dreamlike', 'classic', 'challenge'] },
        { title: 'In the Mood for Love', description: 'Repressed desire blooms through frames of saturated color.', year: 2000, director: 'Wong Kar-wai', tags: ['slow', 'dreamlike', 'contemporary', 'romantic'] },
        { title: 'Tokyo Story', description: 'Profound humanity emerges from quiet domestic moments.', year: 1953, director: 'Yasujirō Ozu', tags: ['slow', 'real', 'classic', 'social'] },
        
        // Fast Paced
        { title: 'Parasite', description: 'Class warfare explodes with dark comic energy and precision.', year: 2019, director: 'Bong Joon-ho', tags: ['fast', 'heavy', 'contemporary', 'social'] },
        { title: 'Mad Max: Fury Road', description: 'Pure kinetic poetry—a two-hour chase driven by visual perfection.', year: 2015, director: 'George Miller', tags: ['fast', 'heavy', 'contemporary', 'challenge'] },
        { title: 'Terminator 2', description: 'Action elevated to art through innovation and precision.', year: 1991, director: 'James Cameron', tags: ['fast', 'challenge', 'contemporary'] },
        
        // Dreamlike
        { title: 'Mulholland Drive', description: 'Dreams collapse into deception in this shimmering fever dream.', year: 2001, director: 'David Lynch', tags: ['dreamlike', 'heavy', 'contemporary', 'solo'] },
        { title: 'Pan\'s Labyrinth', description: 'Myth and fascism collide in a haunting visual fantasia.', year: 2006, director: 'Guillermo del Toro', tags: ['dreamlike', 'heavy', 'contemporary', 'challenge'] },
        { title: 'The Fountain', description: 'Three eras of love and loss rendered in visual wonder.', year: 2006, director: 'Darren Aronofsky', tags: ['dreamlike', 'heavy', 'contemporary', 'solo'] },
        
        // Real & Contemporary
        { title: 'Before Sunrise', description: 'Two strangers discover connection through language and presence.', year: 1995, director: 'Richard Linklater', tags: ['real', 'contemporary', 'solo', 'slow'] },
        { title: 'Boyhood', description: 'Twelve years of life captured with intimate authenticity.', year: 2014, director: 'Richard Linklater', tags: ['real', 'contemporary', 'slow', 'social'] },
        { title: 'Moonlight', description: 'Three moments in a life rendered with poetic grace.', year: 2016, director: 'Barry Jenkins', tags: ['real', 'contemporary', 'slow', 'solo'] },
        
        // Classic
        { title: 'The Seventh Seal', description: 'A knight confronts mortality with quiet philosophical grace.', year: 1957, director: 'Ingmar Bergman', tags: ['classic', 'heavy', 'challenge', 'slow'] },
        { title: 'Vertigo', description: 'Obsession rendered as visual mastery and psychological torment.', year: 1958, director: 'Alfred Hitchcock', tags: ['classic', 'challenge', 'slow', 'solo'] },
        { title: 'Casablanca', description: 'Sacrifice and romance amid wartime intrigue.', year: 1942, director: 'Michael Curtiz', tags: ['classic', 'heavy', 'social', 'romantic'] },
        
        // Social
        { title: 'Chungking Express', description: 'Chance encounters blossom into unexpected romance.', year: 1994, director: 'Wong Kar-wai', tags: ['social', 'dreamlike', 'contemporary', 'light'] },
        { title: 'Memories of Murder', description: 'A procedural spiral into darkness and moral ambiguity.', year: 2003, director: 'Bong Joon-ho', tags: ['social', 'heavy', 'contemporary', 'challenge'] },
        { title: 'La La Land', description: 'Romance and ambition dance through a modern city.', year: 2016, director: 'Damien Chazelle', tags: ['social', 'light', 'contemporary', 'romantic'] }
    ];

    // Score films based on mood match with continuous scaling
    const scoredFilms = filmDatabase.map(film => {
        let score = 0;

        // Weight: light (0-40) vs heavy (60-100)
        if (film.tags.includes('light')) {
            score += Math.max(0, 40 - mood.weight) / 20; // peaks at weight=0
        }
        if (film.tags.includes('heavy')) {
            score += Math.max(0, mood.weight - 60) / 20; // peaks at weight=100
        }

        // Pace: slow (0-40) vs fast (60-100)
        if (film.tags.includes('slow')) {
            score += Math.max(0, 40 - mood.pace) / 20; // peaks at pace=0
        }
        if (film.tags.includes('fast')) {
            score += Math.max(0, mood.pace - 60) / 20; // peaks at pace=100
        }

        // Comfort: challenge (0-40) vs light/comfort (60-100)
        if (film.tags.includes('challenge')) {
            score += Math.max(0, 40 - mood.comfort) / 20; // peaks at comfort=0
        }
        if (film.tags.includes('light')) {
            score += Math.max(0, mood.comfort - 60) / 20; // peaks at comfort=100
        }

        // Reality: dreamlike (0-40) vs real (60-100)
        if (film.tags.includes('dreamlike')) {
            score += Math.max(0, 40 - mood.reality) / 20; // peaks at reality=0
        }
        if (film.tags.includes('real')) {
            score += Math.max(0, mood.reality - 60) / 20; // peaks at reality=100
        }

        // Era: classic (0-40) vs contemporary (60-100)
        if (film.tags.includes('classic')) {
            score += Math.max(0, 40 - mood.era) / 20; // peaks at era=0
        }
        if (film.tags.includes('contemporary')) {
            score += Math.max(0, mood.era - 60) / 20; // peaks at era=100
        }

        // Social: solo (0-40) vs social (60-100)
        if (film.tags.includes('solo')) {
            score += Math.max(0, 40 - mood.social) / 20; // peaks at social=0
        }
        if (film.tags.includes('social')) {
            score += Math.max(0, mood.social - 60) / 20; // peaks at social=100
        }

        // Add small random variance to break ties
        score += Math.random() * 0.1;

        return { ...film, score };
    });

    // Sort by score and return top 6
    const topFilms = scoredFilms
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score, tags, ...film }) => film);

    // Fetch posters for all returned films
    const filmsWithPosters = await Promise.all(
        topFilms.map(async (film) => {
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
        { title: 'Memories of Murder', description: 'A procedural spiral into darkness and moral ambiguity.', year: 2003, director: 'Bong Joon-ho' }
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
