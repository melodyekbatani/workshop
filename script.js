class FilmMoodSelector {
    constructor() {
        this.setupElements();
        this.attachEventListeners();
        this.sliderValues = {
            weight: 50,
            pace: 50,
            comfort: 50,
            reality: 50,
            era: 50,
            social: 50
        };
        this.uploadedImage = null;
    }

    setupElements() {
        // Sliders
        this.sliders = {
            weight: document.getElementById('slider-weight'),
            pace: document.getElementById('slider-pace'),
            comfort: document.getElementById('slider-comfort'),
            reality: document.getElementById('slider-reality'),
            era: document.getElementById('slider-era'),
            social: document.getElementById('slider-social')
        };

        // Values
        this.values = {
            weight: document.getElementById('value-weight'),
            pace: document.getElementById('value-pace'),
            comfort: document.getElementById('value-comfort'),
            reality: document.getElementById('value-reality'),
            era: document.getElementById('value-era'),
            social: document.getElementById('value-social')
        };

        // Upload
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.uploadPreview = document.getElementById('uploadPreview');
        this.previewImage = document.getElementById('previewImage');

        // Buttons & Sections
        this.discoverBtn = document.getElementById('discoverBtn');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsContainer = document.getElementById('resultsContainer');
    }

    attachEventListeners() {
        // Slider updates
        Object.entries(this.sliders).forEach(([key, slider]) => {
            slider.addEventListener('input', (e) => this.updateSlider(key, e.target.value));
        });

        // Upload
        this.uploadZone.addEventListener('click', () => this.fileInput.click());
        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.style.borderColor = 'var(--accent)';
        });
        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.style.borderColor = 'var(--accent-light)';
        });
        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.style.borderColor = 'var(--accent-light)';
            if (e.dataTransfer.files[0]) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Discover button
        this.discoverBtn.addEventListener('click', () => this.discoverFilms());
    }

    updateSlider(key, value) {
        this.sliderValues[key] = parseInt(value);
        this.values[key].textContent = value;
    }

    handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = e.target.result;
            this.previewImage.src = this.uploadedImage;
            this.uploadZone.style.display = 'none';
            this.uploadPreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }

    async discoverFilms() {
        const backendUrl = window.BACKEND_URL || 'http://localhost:3001';
        
        this.discoverBtn.disabled = true;
        this.discoverBtn.textContent = 'Discovering…';

        try {
            const response = await fetch(`${backendUrl}/api/generate-films`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mood: this.sliderValues,
                    hasImage: !!this.uploadedImage
                })
            });

            const data = await response.json();
            this.displayResults(data.films || this.getDefaultFilms());
            this.resultsSection.style.display = 'block';
            this.resultsSection.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error:', error);
            this.displayResults(this.getDefaultFilms());
            this.resultsSection.style.display = 'block';
        } finally {
            this.discoverBtn.disabled = false;
            this.discoverBtn.textContent = 'Discover Films';
        }
    }

    displayResults(films) {
        this.resultsContainer.innerHTML = films.map((film, index) => `
            <div class="film-card" style="animation-delay: ${index * 0.1}s">
                <div class="film-poster">
                    ${film.poster ? `<img src="${film.poster}" alt="${film.title}">` : '🎬'}
                </div>
                <div class="film-info">
                    <h3 class="film-title">${film.title}</h3>
                    <p class="film-description">${film.description}</p>
                    <p class="film-metadata">${film.year} • ${film.director}</p>
                    <a href="#" class="film-action">Explore →</a>
                </div>
            </div>
        `).join('');
    }

    getDefaultFilms() {
        return [
            {
                title: 'Stalker',
                description: 'A meditative journey through emotion and existential wonder.',
                year: 1979,
                director: 'Andrei Tarkovsky'
            },
            {
                title: 'Mulholland Drive',
                description: 'Dreams collapse into deception in this shimmering fever dream.',
                year: 2001,
                director: 'David Lynch'
            },
            {
                title: 'Before Sunrise',
                description: 'Two strangers discover connection through language and presence.',
                year: 1995,
                director: 'Richard Linklater'
            },
            {
                title: 'The Seventh Seal',
                description: 'A knight confronts mortality with quiet philosophical grace.',
                year: 1957,
                director: 'Ingmar Bergman'
            },
            {
                title: 'Chungking Express',
                description: 'Chance encounters blossom into unexpected romance.',
                year: 1994,
                director: 'Wong Kar-wai'
            },
            {
                title: 'Memories of Murder',
                description: 'A procedural spiral into darkness and moral ambiguity.',
                year: 2003,
                director: 'Bong Joon-ho'
            }
        ];
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    new FilmMoodSelector();
});


