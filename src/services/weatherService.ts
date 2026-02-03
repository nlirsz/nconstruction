import { WeatherCondition } from '../types';

// Coordenadas padrão (Caçador - SC, base dos projetos mockados) caso o GPS falhe
const DEFAULT_COORDS = { lat: -26.7753, lng: -51.0150 };

export interface WeatherData {
  current: {
    temperature: number;
    condition: WeatherCondition;
    isDay: boolean;
    windSpeed: number;
  };
  daily: {
    time: string[];
    weatherCode: number[];
    maxTemp: number[];
    minTemp: number[];
    rainProb: number[];
  };
  insights: string[];
}

// Mapeamento de códigos WMO (World Meteorological Organization) para nosso Enum
const mapWmoToCondition = (code: number): WeatherCondition => {
  if (code === 0 || code === 1) return WeatherCondition.SUNNY;
  if (code === 2 || code === 3) return WeatherCondition.CLOUDY;
  if ([45, 48].includes(code)) return WeatherCondition.CLOUDY; // Nevoeiro
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return WeatherCondition.RAINY;
  if ([95, 96, 99].includes(code)) return WeatherCondition.STORM;
  return WeatherCondition.CLOUDY; // Default
};

export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(DEFAULT_COORDS);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn("Geolocation error, using default:", err);
        resolve(DEFAULT_COORDS);
      }
    );
  });
};

export const fetchWeatherForecast = async (): Promise<WeatherData | null> => {
  try {
    const coords = await getCurrentLocation();
    
    // Open-Meteo API URL
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API error');
    
    const data = await response.json();

    const currentCondition = mapWmoToCondition(data.current.weather_code);
    
    // Gerar Insights
    const insights: string[] = [];
    const todayRainProb = data.daily.precipitation_probability_max[0];
    const tomorrowRainProb = data.daily.precipitation_probability_max[1];
    
    if (todayRainProb > 60) {
      insights.push('🔴 Alta chance de chuva hoje. Priorizar tarefas internas (alvenaria, reboco interno).');
    } else if (todayRainProb > 30) {
      insights.push('🟡 Risco de chuva passageira. Mantenha lonas de proteção acessíveis.');
    } else {
      insights.push('🟢 Dia favorável para atividades externas e concretagem.');
    }

    if (tomorrowRainProb > 70) {
      insights.push('⚠️ Alerta: Chuva forte prevista para amanhã. Programe recebimento de materiais sensíveis para outro dia.');
    }

    return {
      current: {
        temperature: Math.round(data.current.temperature_2m),
        condition: currentCondition,
        isDay: !!data.current.is_day,
        windSpeed: data.current.wind_speed_10m
      },
      daily: {
        time: data.daily.time,
        weatherCode: data.daily.weather_code,
        maxTemp: data.daily.temperature_2m_max,
        minTemp: data.daily.temperature_2m_min,
        rainProb: data.daily.precipitation_probability_max
      },
      insights
    };

  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
};
