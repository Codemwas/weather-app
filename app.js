// Helper: map WMO codes to emoji/icon + description
function getWeatherIconAndDesc(code, isDay = true) {
    const map = {
        0: { desc: "Clear sky", icon: "☀️" },
        1: { desc: "Mainly clear", icon: "🌤️" },
        2: { desc: "Partly cloudy", icon: "⛅" },
        3: { desc: "Overcast", icon: "☁️" },
        45: { desc: "Fog", icon: "🌫️" },
        48: { desc: "Depositing rime fog", icon: "🌫️" },
        51: { desc: "Light drizzle", icon: "🌦️" },
        53: { desc: "Moderate drizzle", icon: "🌧️" },
        55: { desc: "Dense drizzle", icon: "🌧️" },
        56: { desc: "Freezing drizzle", icon: "❄️🌧️" },
        57: { desc: "Dense freezing drizzle", icon: "❄️" },
        61: { desc: "Slight rain", icon: "🌦️" },
        63: { desc: "Moderate rain", icon: "🌧️" },
        65: { desc: "Heavy rain", icon: "🌧️💧" },
        66: { desc: "Freezing rain", icon: "❄️🌧️" },
        67: { desc: "Heavy freezing rain", icon: "❄️🌧️" },
        71: { desc: "Slight snow", icon: "🌨️" },
        73: { desc: "Moderate snow", icon: "❄️" },
        75: { desc: "Heavy snow", icon: "❄️❄️" },
        77: { desc: "Snow grains", icon: "❄️" },
        80: { desc: "Slight rain showers", icon: "🌦️" },
        81: { desc: "Moderate showers", icon: "🌧️" },
        82: { desc: "Violent showers", icon: "⛈️" },
        85: { desc: "Slight snow showers", icon: "🌨️" },
        86: { desc: "Heavy snow showers", icon: "❄️🌨️" },
        95: { desc: "Thunderstorm", icon: "⛈️" },
        96: { desc: "Thunderstorm with hail", icon: "⛈️🧊" },
        99: { desc: "Severe thunderstorm", icon: "⛈️💥" }
    };
    const entry = map[code] || { desc: "Unknown", icon: "🌈" };
    return { icon: entry.icon, description: entry.desc };
}

// format date for forecast (weekday)
function getWeekday(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// API endpoints
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// Main React Component
const WeatherApp = () => {
    const [city, setCity] = React.useState("New York");
    const [inputValue, setInputValue] = React.useState("");
    const [weatherData, setWeatherData] = React.useState(null);
    const [forecastList, setForecastList] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [lastUpdated, setLastUpdated] = React.useState(null);

    // core fetch logic: get coords -> fetch weather + forecast
    const fetchWeatherForCity = async (cityName) => {
        if (!cityName.trim()) return;
        setLoading(true);
        setError(null);
        try {
            // 1. geocoding
            const geoResp = await fetch(`${GEO_API}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`);
            const geoData = await geoResp.json();
            if (!geoData.results || geoData.results.length === 0) {
                throw new Error(`City "${cityName}" not found. Try another name.`);
            }
            const { latitude, longitude, name, country } = geoData.results[0];
            const displayName = country ? `${name}, ${country}` : name;
            
            // 2. current weather + 5-day forecast
            const weatherResp = await fetch(
                `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto&forecast_days=6`
            );
            const weatherJson = await weatherResp.json();
            if (!weatherJson.current_weather) {
                throw new Error("Weather data unavailable");
            }
            
            const current = weatherJson.current_weather;
            const daily = weatherJson.daily;
            
            const wmoCode = current.weathercode;
            const { icon: currentIcon, description: currentDesc } = getWeatherIconAndDesc(wmoCode, true);
            
            let feelsLike = current.temperature;
            if (current.windspeed > 10 && current.temperature <= 10) {
                feelsLike = Math.round(13.12 + 0.6215 * current.temperature - 11.37 * Math.pow(current.windspeed, 0.16) + 0.3965 * current.temperature * Math.pow(current.windspeed, 0.16));
            } else if (current.temperature > 26) {
                feelsLike = Math.round(current.temperature - 2);
            } else {
                feelsLike = Math.round(current.temperature);
            }
            
            const currentWeatherObj = {
                temperature: Math.round(current.temperature),
                windspeed: current.windspeed,
                weathercode: wmoCode,
                description: currentDesc,
                icon: currentIcon,
                city: displayName,
                humidity: "—",
                feelslike: feelsLike
            };
            
            // get humidity data
            try {
                const hourlyParams = `latitude=${latitude}&longitude=${longitude}&hourly=relativehumidity_2m&current_weather=false&timezone=auto&forecast_hours=1`;
                const hourlyResp = await fetch(`https://api.open-meteo.com/v1/forecast?${hourlyParams}`);
                const hourlyJson = await hourlyResp.json();
                if (hourlyJson.hourly && hourlyJson.hourly.relativehumidity_2m && hourlyJson.hourly.relativehumidity_2m.length) {
                    currentWeatherObj.humidity = hourlyJson.hourly.relativehumidity_2m[0];
                }
            } catch (e) {
                currentWeatherObj.humidity = "—";
            }
            
            // build forecast
            const forecastDays = [];
            if (daily && daily.time) {
                for (let i = 0; i < daily.time.length; i++) {
                    const code = daily.weathercode[i];
                    const { icon: fIcon, description: fDesc } = getWeatherIconAndDesc(code);
                    forecastDays.push({
                        date: daily.time[i],
                        weekday: getWeekday(daily.time[i]),
                        maxTemp: Math.round(daily.temperature_2m_max[i]),
                        minTemp: Math.round(daily.temperature_2m_min[i]),
                        weatherCode: code,
                        icon: fIcon,
                        description: fDesc,
                        wind: daily.windspeed_10m_max ? Math.round(daily.windspeed_10m_max[i]) : null
                    });
                }
            }
            
            setWeatherData(currentWeatherObj);
            setForecastList(forecastDays.slice(0, 5));
            setLastUpdated(new Date().toLocaleTimeString());
            setCity(displayName);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to load weather data");
            setWeatherData(null);
            setForecastList([]);
        } finally {
            setLoading(false);
        }
    };
    
    // initial load
    React.useEffect(() => {
        fetchWeatherForCity(city);
    }, []);
    
    const handleSearch = () => {
        if (inputValue.trim()) {
            fetchWeatherForCity(inputValue.trim());
            setInputValue("");
        }
    };
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSearch();
    };
    
    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation not supported by your browser");
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
                const geoResp = await fetch(reverseUrl);
                const geoJson = await geoResp.json();
                let locationName = "Current Location";
                if (geoJson.address) {
                    const cityPart = geoJson.address.city || geoJson.address.town || geoJson.address.village || geoJson.address.state || "Your Area";
                    locationName = cityPart;
                }
                
                const weatherResp = await fetch(`${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto&forecast_days=6`);
                const weatherJson = await weatherResp.json();
                if (!weatherJson.current_weather) throw new Error("No weather");
                
                const current = weatherJson.current_weather;
                const daily = weatherJson.daily;
                const { icon: curIcon, description: curDesc } = getWeatherIconAndDesc(current.weathercode);
                
                let feelsLikeVal = current.temperature;
                if (current.windspeed > 10 && current.temperature <= 10) {
                    feelsLikeVal = Math.round(13.12 + 0.6215 * current.temperature - 11.37 * Math.pow(current.windspeed, 0.16) + 0.3965 * current.temperature * Math.pow(current.windspeed, 0.16));
                } else if (current.temperature > 26) feelsLikeVal = Math.round(current.temperature - 2);
                else feelsLikeVal = Math.round(current.temperature);
                
                let humidityVal = "—";
                try {
                    const hourlyReq = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=relativehumidity_2m&forecast_hours=1`);
                    const hourlyData = await hourlyReq.json();
                    if (hourlyData.hourly?.relativehumidity_2m?.[0]) humidityVal = hourlyData.hourly.relativehumidity_2m[0];
                } catch(e) {}
                
                const currentObj = {
                    temperature: Math.round(current.temperature),
                    windspeed: current.windspeed,
                    weathercode: current.weathercode,
                    description: curDesc,
                    icon: curIcon,
                    city: locationName,
                    humidity: humidityVal,
                    feelslike: feelsLikeVal
                };
                
                const forecastDays = [];
                if (daily && daily.time) {
                    for (let i=0; i<daily.time.length && i<6; i++) {
                        const { icon: fIcon, description: fDesc } = getWeatherIconAndDesc(daily.weathercode[i]);
                        forecastDays.push({
                            date: daily.time[i],
                            weekday: getWeekday(daily.time[i]),
                            maxTemp: Math.round(daily.temperature_2m_max[i]),
                            minTemp: Math.round(daily.temperature_2m_min[i]),
                            icon: fIcon,
                            description: fDesc,
                        });
                    }
                }
                setWeatherData(currentObj);
                setForecastList(forecastDays.slice(0,5));
                setCity(locationName);
                setLastUpdated(new Date().toLocaleTimeString());
                setError(null);
                setLoading(false);
            } catch (err) {
                setError("Could not get weather for your location");
                setLoading(false);
            }
        }, (err) => {
            setError("Location access denied or unavailable");
            setLoading(false);
        });
    };
    
    return (
        <div className="app-wrapper">
            <div className="header">
                <div className="logo">
                    <h1>Mwasvision <span>⛅ realtime</span></h1>
                </div>
                <div className="search-area">
                    <input 
                        type="text" 
                        className="search-input"
                        placeholder="Search city... e.g., London, Tokyo"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <button className="search-btn" onClick={handleSearch}>🔍 Search</button>
                    <button className="loc-btn" onClick={getCurrentLocation}>📍 Current</button>
                </div>
            </div>
            
            {loading && <div className="status-message">🌀 Fetching latest weather data...</div>}
            {error && <div className="status-message error-message">⚠️ {error}</div>}
            
            {weatherData && !loading && (
                <>
                    <div className="current-weather">
                        <div className="weather-main">
                            <div>
                                <h2 style={{fontWeight:600, marginBottom:'0.3rem'}}>{weatherData.city}</h2>
                                <div className="temp-section">
                                    <span className="temp">{weatherData.temperature}°C</span>
                                    <span className="desc">{weatherData.description}</span>
                                    <span className="icon-large">{weatherData.icon}</span>
                                </div>
                            </div>
                        </div>
                        <div className="details">
                            <div className="detail-item">💨 Wind: {weatherData.windspeed} km/h</div>
                            <div className="detail-item">🌡️ Feels like: {weatherData.feelslike}°C</div>
                            <div className="detail-item">💧 Humidity: {weatherData.humidity !== "—" ? `${weatherData.humidity}%` : "—"}</div>
                            <div className="detail-item">🕒 Updated: {lastUpdated}</div>
                        </div>
                    </div>
                    
                    <div className="forecast-section">
                        <div className="forecast-title">📅 5-Day Forecast <span style={{fontSize:'0.9rem', fontWeight:'normal'}}>daily outlook</span></div>
                        <div className="forecast-grid">
                            {forecastList.map((day, idx) => (
                                <div className="forecast-card" key={idx}>
                                    <div className="forecast-day">{day.weekday}</div>
                                    <div className="forecast-icon">{day.icon}</div>
                                    <div className="forecast-temp">{day.maxTemp}° / {day.minTemp}°</div>
                                    <div className="forecast-desc">{day.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="extra-info">
                        <span>🌍 Powered by Open-Meteo • No API key needed</span>
                        <span>✨ Real-time conditions & smart feels-like</span>
                    </div>
                </>
            )}
            {!weatherData && !loading && !error && (
                <div className="status-message" style={{background:'rgba(0,0,0,0.4)', marginTop:'2rem'}}>✨ Enter a city or use your location to see live weather ✨</div>
            )}
        </div>
    );
};

// Render the app
ReactDOM.createRoot(document.getElementById("root")).render(<WeatherApp />);