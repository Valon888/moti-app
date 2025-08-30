// Weather App Script for Moti App
class WeatherApp {
    constructor() {
        this.API_BASE = 'https://api.open-meteo.com/v1';
        this.GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1';
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateDateTime();
    }

    initializeElements() {
        // Input elements
        this.cityInput = document.getElementById('cityInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.locationBtn = document.getElementById('locationBtn');
        
        // Display elements
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.currentWeather = document.getElementById('currentWeather');
        this.forecast = document.getElementById('forecast');
        
        // Weather data elements
        this.currentCity = document.getElementById('currentCity');
        this.currentDate = document.getElementById('currentDate');
        this.currentTemp = document.getElementById('currentTemp');
        this.currentCondition = document.getElementById('currentCondition');
        this.currentWeatherIcon = document.getElementById('currentWeatherIcon');
        this.feelsLike = document.getElementById('feelsLike');
        this.windSpeed = document.getElementById('windSpeed');
        this.visibility = document.getElementById('visibility');
        this.humidity = document.getElementById('humidity');
        this.forecastContainer = document.getElementById('forecastContainer');
    }

    attachEventListeners() {
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });
        this.locationBtn.addEventListener('click', () => this.handleLocationSearch());
    }

    updateDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        this.currentDate.textContent = now.toLocaleDateString('en-US', options);
    }

    showLoading() {
        this.hideAllSections();
        this.loading.classList.remove('hidden');
    }

    showError(message) {
        this.hideAllSections();
        this.errorText.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    showWeather() {
        this.hideAllSections();
        this.currentWeather.classList.remove('hidden');
        this.forecast.classList.remove('hidden');
    }

    hideAllSections() {
        this.loading.classList.add('hidden');
        this.errorMessage.classList.add('hidden');
        this.currentWeather.classList.add('hidden');
        this.forecast.classList.add('hidden');
    }

    async handleSearch() {
        const city = this.cityInput.value.trim();
        if (!city) {
            this.showError('Please enter a city name');
            return;
        }

        try {
            this.showLoading();
            const coordinates = await this.geocodeCity(city);
            await this.fetchWeatherData(coordinates.latitude, coordinates.longitude, city);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('City not found. Please try again.');
        }
    }

    async handleLocationSearch() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser');
            return;
        }

        this.showLoading();
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const cityName = await this.reverseGeocode(latitude, longitude);
                    await this.fetchWeatherData(latitude, longitude, cityName);
                } catch (error) {
                    console.error('Location weather error:', error);
                    this.showError('Unable to get weather for your location');
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.showError('Unable to access your location. Please enable location services.');
            }
        );
    }

    async geocodeCity(city) {
        const response = await fetch(`${this.GEOCODING_API}/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        
        if (!response.ok) {
            throw new Error('Geocoding failed');
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error('City not found');
        }
        
        return {
            latitude: data.results[0].latitude,
            longitude: data.results[0].longitude
        };
    }

    async reverseGeocode(lat, lon) {
        try {
            const response = await fetch(`${this.GEOCODING_API}/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                return data.results[0].name || 'Current Location';
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
        
        return 'Current Location';
    }

    async fetchWeatherData(latitude, longitude, cityName) {
        try {
            const currentWeatherUrl = `${this.API_BASE}/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=visibility&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
            
            const response = await fetch(currentWeatherUrl);
            
            if (!response.ok) {
                throw new Error('Weather data fetch failed');
            }
            
            const data = await response.json();
            
            this.updateCurrentWeather(data, cityName);
            this.updateForecast(data);
            this.showWeather();
            
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Unable to fetch weather data. Please try again.');
        }
    }

    updateCurrentWeather(data, cityName) {
        const current = data.current;
        
        this.currentCity.textContent = cityName;
        this.currentTemp.textContent = `${Math.round(current.temperature_2m)}°`;
        this.currentCondition.textContent = this.getWeatherDescription(current.weather_code);
        this.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°`;
        this.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        this.humidity.textContent = `${current.relative_humidity_2m}%`;
        
        // Set visibility (using first hourly value as approximation)
        if (data.hourly && data.hourly.visibility && data.hourly.visibility[0]) {
            this.visibility.textContent = `${Math.round(data.hourly.visibility[0] / 1000)} km`;
        } else {
            this.visibility.textContent = 'N/A';
        }
        
        // Set weather icon
        this.currentWeatherIcon.src = this.getWeatherIcon(current.weather_code);
        this.currentWeatherIcon.alt = this.getWeatherDescription(current.weather_code);
    }

    updateForecast(data) {
        this.forecastContainer.innerHTML = '';
        
        // Create forecast for next 5 days
        for (let i = 1; i <= 5; i++) {
            const forecastItem = this.createForecastItem(
                data.daily.time[i],
                data.daily.weather_code[i],
                data.daily.temperature_2m_max[i],
                data.daily.temperature_2m_min[i]
            );
            this.forecastContainer.appendChild(forecastItem);
        }
    }

    createForecastItem(date, weatherCode, maxTemp, minTemp) {
        const item = document.createElement('div');
        item.className = 'forecast-item';
        
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        
        item.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <img src="${this.getWeatherIcon(weatherCode)}" alt="${this.getWeatherDescription(weatherCode)}" class="forecast-icon">
            <div class="forecast-condition">${this.getWeatherDescription(weatherCode)}</div>
            <div class="forecast-temps">
                <span class="forecast-high">${Math.round(maxTemp)}°</span>
                <span class="forecast-low">${Math.round(minTemp)}°</span>
            </div>
        `;
        
        return item;
    }

    getWeatherDescription(code) {
        const weatherCodes = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Thunderstorm with heavy hail'
        };
        
        return weatherCodes[code] || 'Unknown';
    }

    getWeatherIcon(code) {
        // Using OpenWeatherMap icons as placeholder
        const iconMap = {
            0: '01d', // Clear sky
            1: '02d', // Mainly clear
            2: '03d', // Partly cloudy
            3: '04d', // Overcast
            45: '50d', // Fog
            48: '50d', // Depositing rime fog
            51: '09d', // Light drizzle
            53: '09d', // Moderate drizzle
            55: '09d', // Dense drizzle
            61: '10d', // Slight rain
            63: '10d', // Moderate rain
            65: '10d', // Heavy rain
            71: '13d', // Slight snow
            73: '13d', // Moderate snow
            75: '13d', // Heavy snow
            95: '11d', // Thunderstorm
            96: '11d', // Thunderstorm with hail
            99: '11d'  // Thunderstorm with heavy hail
        };
        
        const iconCode = iconMap[code] || '01d';
        return `https://openweathermap.org/img/w/${iconCode}.png`;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});