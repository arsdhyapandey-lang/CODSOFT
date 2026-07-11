const express = require('express');
const path = require('path');

const app = express();
const port = 5000;

// Serve static files from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

// Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
}); 

// Mock Data
const movies = [
    { movie_id: 1, title: 'The Matrix', genres: ['Sci-Fi', 'Action'] },
    { movie_id: 2, title: 'Inception', genres: ['Sci-Fi', 'Action'] },
    { movie_id: 3, title: 'The Notebook', genres: ['Romance', 'Drama'] },
    { movie_id: 4, title: 'Titanic', genres: ['Romance', 'Drama'] },
    { movie_id: 5, title: 'Avengers', genres: ['Action', 'Sci-Fi'] }
];

// User ratings: user_id -> { movie_id: rating }
const userRatings = {
    1: { 1: 5, 2: 4, 3: 1, 4: 2, 5: 5 },
    2: { 1: 4, 2: 5, 3: 2, 4: 1, 5: 4 },
    3: { 1: 1, 2: 1, 3: 5, 4: 4, 5: 2 },
    4: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 2 }
};

// --- Math Helpers ---
function dotProduct(vecA, vecB) {
    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
        product += vecA[i] * vecB[i];
    }
    return product;
}

function magnitude(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}

function cosineSimilarity(vecA, vecB) {
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct(vecA, vecB) / (magA * magB);
}

// --- Data Preparation for Content-Based Filtering ---
const allGenres = Array.from(new Set(movies.flatMap(m => m.genres))).sort();
movies.forEach(movie => {
    movie.genreVector = allGenres.map(g => movie.genres.includes(g) ? 1 : 0);
});

// --- API Endpoints ---
app.get('/api/recommend/content', (req, res) => {
    const movieTitle = req.query.movie;
    if (!movieTitle) return res.status(400).json({ error: "Movie title is required" });

    const targetMovie = movies.find(m => m.title.toLowerCase() === movieTitle.toLowerCase());
    if (!targetMovie) return res.status(404).json({ error: "Movie not found in database." });

    // Calculate similarity with all other movies
    const similarities = [];
    for (const m of movies) {
        if (m.movie_id !== targetMovie.movie_id) {
            const sim = cosineSimilarity(targetMovie.genreVector, m.genreVector);
            similarities.push({ title: m.title, sim });
        }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.sim - a.sim);
    
    // Take top 2
    const recommendations = similarities.slice(0, 2).map(item => item.title);

    res.json({ recommendations });
});

app.get('/api/recommend/collaborative', (req, res) => {
    const userId = parseInt(req.query.user_id);
    if (!userId || !userRatings[userId]) {
        return res.status(404).json({ error: "User not found" });
    }

    const targetRatings = userRatings[userId];
    const movieIds = [1, 2, 3, 4, 5];
    
    // Helper to get vector
    const getVector = (uId) => movieIds.map(id => userRatings[uId][id] || 0);
    const targetVector = getVector(userId);
    
    // Find similar users
    const similarities = [];
    for (const uIdStr in userRatings) {
        const uId = parseInt(uIdStr);
        if (uId !== userId) {
            const vec = getVector(uId);
            const sim = cosineSimilarity(targetVector, vec);
            similarities.push({ uId, sim });
        }
    }
    
    similarities.sort((a, b) => b.sim - a.sim);
    
    if (similarities.length === 0) {
        return res.json({ recommendations: [] });
    }
    
    const mostSimilarUserId = similarities[0].uId;
    const similarUserRatings = userRatings[mostSimilarUserId];
    
    // Recommend movies the similar user rated >= 4 that the target user rated < 4
    const recommendations = [];
    for (const mIdStr in similarUserRatings) {
        const mId = parseInt(mIdStr);
        if (similarUserRatings[mId] >= 4 && (targetRatings[mId] || 0) < 4) {
            const movie = movies.find(m => m.movie_id === mId);
            if (movie) recommendations.push(movie.title);
        }
    }
    
    res.json({ recommendations: recommendations.slice(0, 2) });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});