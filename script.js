class FilmMoodSelector {
    constructor() {
        this.setupDarkMode();
        this.setupElements();
        this.setupGenreSelector();
        this.attachEventListeners();
        
        this.sliderValues = {
            weight: 50,
            pace: 50,
            comfort: 50,
            reality: 50,
            era: 50,
            social: 50
        };
        
        this.selectedGenre = 'All';
        this.currentFilms = [];
        this.uploadedImage = null;
    }

    // ========== DARK MODE ==========
    setupDarkMode() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            const icon = toggle.querySelector('.toggle-icon');
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleDarkMode() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // ========== ELEMENTS SETUP ==========
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

        // Buttons & Sections
        this.discoverBtn = document.getElementById('discoverBtn');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsContainer = document.getElementById('resultsContainer');
        
        // Modal
        this.modal = document.getElementById('movieModal');
        this.modalBackdrop = this.modal?.querySelector('.modal-backdrop');
        this.modalClose = this.modal?.querySelector('.modal-close');
    }

    // ========== GENRE SELECTOR ==========
    setupGenreSelector() {
        const chips = document.querySelectorAll('.genre-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                // Remove active from all
                chips.forEach(c => c.classList.remove('active'));
                // Add active to clicked
                chip.classList.add('active');
                // Update selected genre
                this.selectedGenre = chip.getAttribute('data-genre');
            });
        });
    }

    // ========== MODAL FUNCTIONS ==========
    openModal(film) {
        if (!this.modal) return;

        const modalDetails = this.modal.querySelector('.modal-details');
        const modalPosterSection = this.modal.querySelector('.modal-poster-section');
        
        // Poster
        const modalPoster = this.modal.querySelector('.modal-poster');
        if (modalPoster) {
            if (film.poster) {
                modalPoster.innerHTML = `<img src="${film.poster}" alt="${film.title}" style="width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">`;
            } else {
                modalPoster.innerHTML = '<div style="width: 100%; aspect-ratio: 3/4; display: flex; align-items: center; justify-content: center; font-size: 4rem; background: linear-gradient(135deg, var(--accent-light), var(--accent));">🎬</div>';
            }
        }

        // Title
        const modalTitle = this.modal.querySelector('.modal-title');
        if (modalTitle) modalTitle.textContent = film.title;

        // Metadata
        const modalMeta = this.modal.querySelector('.modal-metadata');
        if (modalMeta) modalMeta.textContent = `${film.year} • Directed by ${film.director}`;

        // Description
        const modalDesc = this.modal.querySelector('.modal-description');
        if (modalDesc) modalDesc.textContent = film.description;

        // IMDb Link
        const modalLink = this.modal.querySelector('.modal-link');
        if (modalLink) {
            const imdbUrl = `https://www.imdb.com/find?q=${encodeURIComponent(film.title)}`;
            modalLink.href = imdbUrl;
            modalLink.target = '_blank';
            modalLink.textContent = '🔗 Find on IMDb';
        }

        // Show modal
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // ========== EVENT LISTENERS ==========
    attachEventListeners() {
        // Dark mode toggle
        const darkToggle = document.getElementById('darkModeToggle');
        if (darkToggle) {
            darkToggle.addEventListener('click', () => this.toggleDarkMode());
        }

        // Slider updates
        Object.keys(this.sliders).forEach(key => {
            const slider = this.sliders[key];
            if (slider) {
                slider.addEventListener('input', (e) => {
                    this.sliderValues[key] = parseInt(e.target.value);
                    if (this.values[key]) {
                        this.values[key].textContent = this.sliderValues[key];
                    }
                });
            }
        });

        // Discover button
        if (this.discoverBtn) {
            this.discoverBtn.addEventListener('click', () => this.discoverFilms());
        }

        // Modal close
        if (this.modalClose) {
            this.modalClose.addEventListener('click', () => this.closeModal());
        }

        // Modal backdrop click
        if (this.modalBackdrop) {
            this.modalBackdrop.addEventListener('click', () => this.closeModal());
        }

        // Prevent modal close when clicking inside modal content
        const modalContent = this.modal?.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
        }

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    // ========== DISCOVERY FUNCTIONS ==========
    async discoverFilms() {
        const backendUrl = window.BACKEND_URL || 'http://localhost:3001';
        
        this.discoverBtn.disabled = true;
        this.discoverBtn.textContent = '🎬 Loading...';

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
            this.currentFilms = data.films || this.getDefaultFilms();
            this.displayResults(this.currentFilms);
            
            if (this.resultsSection) {
                this.resultsSection.style.display = 'block';
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error fetching films:', error);
            this.currentFilms = this.getDefaultFilms();
            this.displayResults(this.currentFilms);
            
            if (this.resultsSection) {
                this.resultsSection.style.display = 'block';
            }
        } finally {
            this.discoverBtn.disabled = false;
            this.discoverBtn.textContent = '🍿 Find My Film';
        }
    }

    displayResults(films) {
        if (!this.resultsContainer) return;

        this.resultsContainer.innerHTML = films.map((film, index) => `
            <div class="film-card" style="animation-delay: ${index * 0.1}s">
                <div class="film-poster">
                    ${film.poster ? `<img src="${film.poster}" alt="${film.title}" crossorigin="anonymous" onerror="this.style.display='none'">` : '🎬'}
                </div>
                <div class="film-info">
                    <h3 class="film-title">${film.title}</h3>
                    <p class="film-description">${film.description}</p>
                    <p class="film-metadata">${film.year} • ${film.director}</p>
                </div>
            </div>
        `).join('');

        // Attach click listeners to film cards
        document.querySelectorAll('.film-card').forEach((card, index) => {
            card.addEventListener('click', () => this.openModal(films[index]));
        });
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
            },
            {
                title: 'Amélie',
                description: 'Whimsy and magic in ordinary Parisian moments.',
                year: 2001,
                director: 'Jean-Pierre Jeunet'
            },
            {
                title: 'The Grand Budapest Hotel',
                description: 'A beautifully composed pastiche of elegance and melancholy.',
                year: 2014,
                director: 'Wes Anderson'
            }
        ];
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    new FilmMoodSelector();
});


