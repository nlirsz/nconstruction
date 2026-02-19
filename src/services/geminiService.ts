
import { GoogleGenAI, Type } from "@google/genai";
import { Task, WeatherCondition, SupplyItem } from "../types";

// Uses VITE_GEMINI_API_KEY from environment variables.
// See .env.example for setup instructions.

/**
 * Generates a summary log for the Daily Report (RDO) using AI.
 */
export const generateDailyLog = async (
  tasks: Task[],
  weather: WeatherCondition,
  workforce: number,
  engineerName: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    const taskSummary = tasks
      .map(t => `- ${t.name}: ${t.progress}% (${t.status})`)
      .join("\n");

    const prompt = `Você é um assistente de engenharia civil. Com base nos dados abaixo, gere um breve resumo técnico para o Diário de Obras (RDO) em português brasileiro.
    Engenheiro: ${engineerName}
    Clima: ${weather}
    Efetivo: ${workforce} operários
    Status das Tarefas:
    ${taskSummary}`;

    // Use gemini-3-flash-preview for simple text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    // Access text property directly
    return response.text || "Resumo não disponível.";
  } catch (error) {
    console.error("Gemini generateDailyLog error:", error);
    return "Erro ao gerar diário via IA.";
  }
};

/**
 * Analyzes project risk based on a provided context.
 */
export const analyzeProjectRisk = async (
  projectContext: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    const prompt = `Analise os riscos técnicos e de cronograma para este projeto de construção:
    ${projectContext}
    
    Identifique possíveis gargalos e forneça recomendações de mitigação. Responda em português brasileiro.`;

    // Use gemini-3-pro-preview for complex reasoning tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.3,
      },
    });

    // Access text property directly
    return response.text || "Análise de risco não disponível.";
  } catch (error) {
    console.error("Gemini analyzeProjectRisk error:", error);
    return "Erro na análise de risco via IA.";
  }
};

/**
 * Parses a messy CSV string into structured supply items.
 */
export const parseSupplyList = async (csvContent: string): Promise<SupplyItem[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

    const prompt = `
      You are an expert construction data analyst. 
      I will provide a raw CSV/text that represents a list of materials (Supplies).
      The format might be messy, contain headers in the middle, or different column names.
      
      Your goal is to extract a structured list of items.
      
      Rules:
      1. Identify the 'name' (Combine Description and Dimension if available to make it specific, e.g., "Curva 90 25mm").
      2. Identify the 'quantity' (Look for columns like 'Qtd', 'Quant', 'Quantidade', 'Total'). If there are multiple numbers, pick the one that looks like the Total quantity.
      3. Identify the 'unit' (e.g., pc, un, m, kg, br). If missing, infer 'un'.
      4. Ignore rows that look like Section Titles (e.g., "ÁGUA FRIA") or empty rows.
      5. Return a JSON array.

      CSV Content:
      ${csvContent}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING }
            },
            required: ["name", "quantity", "unit"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const parsed = JSON.parse(jsonText);

    // Map to SupplyItem type (add temporary IDs)
    return parsed.map((item: any, index: number) => ({
      id: `preview-${index}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || 'un',
      checked: false
    }));

  } catch (error) {
    console.error("Gemini parseSupplyList error:", error);
    return [];
  }
};
