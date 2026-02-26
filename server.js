const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

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
        const films = generateFilmSuggestions(mood);

        res.json({ films, success: true });
    } catch (error) {
        console.error('Error:', error);
        res.json({ films: getDefaultFilms(), fallback: true });
    }
});

// Generate film suggestions based on mood dimensions
function generateFilmSuggestions(mood) {
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

    // Score films based on mood match
    const scoredFilms = filmDatabase.map(film => {
        let score = 0;

        // Weight (light = 0-40, heavy = 60-100)
        if (mood.weight < 40 && film.tags.includes('light')) score += 2;
        if (mood.weight > 60 && film.tags.includes('heavy')) score += 2;

        // Pace (slow = 0-40, fast = 60-100)
        if (mood.pace < 40 && film.tags.includes('slow')) score += 2;
        if (mood.pace > 60 && film.tags.includes('fast')) score += 2;

        // Comfort (challenge = 0-40, comfort = 60-100)
        if (mood.comfort > 60 && film.tags.includes('light')) score += 1;
        if (mood.comfort < 40 && film.tags.includes('challenge')) score += 2;

        // Reality (dreamlike = 0-40, real = 60-100)
        if (mood.reality < 40 && film.tags.includes('dreamlike')) score += 2;
        if (mood.reality > 60 && film.tags.includes('real')) score += 2;

        // Era (classic = 0-40, contemporary = 60-100)
        if (mood.era < 40 && film.tags.includes('classic')) score += 2;
        if (mood.era > 60 && film.tags.includes('contemporary')) score += 2;

        // Social (solo = 0-40, social = 60-100)
        if (mood.social < 40 && film.tags.includes('solo')) score += 1;
        if (mood.social > 60 && film.tags.includes('social')) score += 2;

        return { ...film, score };
    });

    // Sort by score and return top 6
    return scoredFilms
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(({ score, tags, ...film }) => film);
}

function getDefaultFilms() {
    return [
        { title: 'Stalker', description: 'A meditative journey through emotion and existential wonder.', year: 1979, director: 'Andrei Tarkovsky' },
        { title: 'Mulholland Drive', description: 'Dreams collapse into deception in this shimmering fever dream.', year: 2001, director: 'David Lynch' },
        { title: 'Before Sunrise', description: 'Two strangers discover connection through language and presence.', year: 1995, director: 'Richard Linklater' },
        { title: 'The Seventh Seal', description: 'A knight confronts mortality with quiet philosophical grace.', year: 1957, director: 'Ingmar Bergman' },
        { title: 'Chungking Express', description: 'Chance encounters blossom into unexpected romance.', year: 1994, director: 'Wong Kar-wai' },
        { title: 'Memories of Murder', description: 'A procedural spiral into darkness and moral ambiguity.', year: 2003, director: 'Bong Joon-ho' }
    ];
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
