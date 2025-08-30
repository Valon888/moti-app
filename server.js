const express = require('express');
const cors = require('cors');
const { fetchWeatherApi } = require('openmeteo');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json()); // Për të pranuar JSON body

// Endpoint për të marrë motin për një qytet (me koordinata)
app.get('/api/weather', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat/lon required" });

    const params = {
        latitude: Number(lat),
        longitude: Number(lon),
        daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset", "precipitation_sum", "precipitation_hours"],
        hourly: ["temperature_2m", "relative_humidity_2m", "pressure_msl", "precipitation", "weathercode"],
        current_weather: true,
        timezone: "auto"
    };
    const url = "https://api.open-meteo.com/v1/forecast";
    try {
        const responses = await fetchWeatherApi(url, params);
        const response = responses[0];
        // Transform Open-Meteo SDK response to plain JSON for frontend compatibility
        const result = {};
        // Current weather
        if (response.current()) {
            const current = response.current();
            result.current_weather = {
                time: new Date((Number(current.time()) + response.utcOffsetSeconds()) * 1000).toISOString(),
                temperature: current.variables(0) ? current.variables(0).value() : undefined,
                weathercode: current.variables(1) ? current.variables(1).value() : undefined,
                windspeed: current.variables(2) ? current.variables(2).value() : undefined,
                winddirection: current.variables(3) ? current.variables(3).value() : undefined
            };
        }
        // Hourly
        if (response.hourly()) {
            const hourly = response.hourly();
            const range = (start, stop, step) => Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);
            let times = [];
            if (hourly.time() !== null && hourly.timeEnd() !== null && hourly.interval() !== null) {
                times = range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
                    (t) => new Date((t + response.utcOffsetSeconds()) * 1000).toISOString()
                );
            }
            result.hourly = {
                time: times,
                temperature_2m: (hourly.variables(0) && typeof hourly.variables(0).valuesArray === 'function') ? hourly.variables(0).valuesArray() : [],
                relative_humidity_2m: (hourly.variables(1) && typeof hourly.variables(1).valuesArray === 'function') ? hourly.variables(1).valuesArray() : [],
                pressure_msl: (hourly.variables(2) && typeof hourly.variables(2).valuesArray === 'function') ? hourly.variables(2).valuesArray() : [],
                precipitation: (hourly.variables(3) && typeof hourly.variables(3).valuesArray === 'function') ? hourly.variables(3).valuesArray() : [],
                weathercode: (hourly.variables(4) && typeof hourly.variables(4).valuesArray === 'function') ? hourly.variables(4).valuesArray() : []
            };
        }
        // Daily
        if (response.daily()) {
            const daily = response.daily();
            const range = (start, stop, step) => Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);
            let times = [];
            if (daily.time() !== null && daily.timeEnd() !== null && daily.interval() !== null) {
                times = range(Number(daily.time()), Number(daily.timeEnd()), daily.interval()).map(
                    (t) => new Date((t + response.utcOffsetSeconds()) * 1000).toISOString()
                );
            }
                        result.daily = {
                                time: times,
                                weathercode: (daily.variables(0) && typeof daily.variables(0).valuesArray === 'function') ? daily.variables(0).valuesArray() : [],
                                temperature_2m_max: (daily.variables(1) && typeof daily.variables(1).valuesArray === 'function') ? daily.variables(1).valuesArray() : [],
                                temperature_2m_min: (daily.variables(2) && typeof daily.variables(2).valuesArray === 'function') ? daily.variables(2).valuesArray() : [],
                                                // Use temp variable to avoid calling .valuesArray() twice and check for array before .map()
                                                sunrise: (() => {
                                                    let arr = (daily.variables(3) && typeof daily.variables(3).valuesArray === 'function') ? daily.variables(3).valuesArray() : [];
                                                    return Array.isArray(arr) ? arr.map(ts => new Date((ts + response.utcOffsetSeconds()) * 1000).toISOString()) : [];
                                                })(),
                                                sunset: (() => {
                                                    let arr = (daily.variables(4) && typeof daily.variables(4).valuesArray === 'function') ? daily.variables(4).valuesArray() : [];
                                                    return Array.isArray(arr) ? arr.map(ts => new Date((ts + response.utcOffsetSeconds()) * 1000).toISOString()) : [];
                                                })(),
                                precipitation_sum: (daily.variables(5) && typeof daily.variables(5).valuesArray === 'function') ? daily.variables(5).valuesArray() : [],
                                precipitation_hours: (daily.variables(6) && typeof daily.variables(6).valuesArray === 'function') ? daily.variables(6).valuesArray() : []
                        };
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint për kërkim të qyteteve (geocoding)
app.get('/api/geocode', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "name required" });
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=sq&format=json`;
        const geoRes = await fetch(url);
        const data = await geoRes.json();
        if (!data.results || !data.results.length) return res.status(404).json({ error: "City not found" });
        const city = data.results[0];
        res.json({
            lat: city.latitude,
            lon: city.longitude,
            label: city.name + (city.country ? ", " + city.country : "")
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint për bulk weather nga WeatherAPI
app.post('/api/weather/bulk', async (req, res) => {
    const apiKey = "YOUR_API_KEY"; // Zëvendëso me WeatherAPI key tënd
    const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=bulk`;

    try {
        const apiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locations: req.body.locations })
        });
        const data = await apiRes.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint për të marrë informacionin e qytetit nga koordinatat (reverse geocoding)
app.get('/api/reverse', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat/lon required" });
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=sq&format=json`;
        const geoRes = await fetch(url);
        const data = await geoRes.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});