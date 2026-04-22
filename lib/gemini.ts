import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { GeminiModel } from "@/types/nodes";

const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY is not set. Check your .env.local file."
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface GeminiGenerateOptions {
  model: GeminiModel;
  systemPrompt?: string;
  userMessage: string;
  imageUrls?: string[];
}

export interface GeminiGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Fetches a URL and converts it to a base64-encoded inline image Part
 * for the Gemini multimodal API.
 */
async function urlToInlinePart(imageUrl: string): Promise<Part> {
  console.log(`[GEMINI] Fetching image from: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    console.error(`[GEMINI] Failed to fetch image! Status: ${response.status} ${response.statusText} URL: ${imageUrl}`);
    throw new Error(
      `Failed to fetch image from ${imageUrl}: ${response.statusText}`
    );
  }
  const contentType = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim() ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  console.log(`[GEMINI] Image fetched OK. mimeType: ${contentType}, size: ${arrayBuffer.byteLength} bytes`);
  return {
    inlineData: {
      mimeType: contentType,
      data: base64,
    },
  };
}

/**
 * Runs a Gemini inference call with adaptive retries and model fallbacks.
 * Specifically handles 503 (High Demand) and 429 (Rate Limit).
 */
export async function generateWithGemini(
  options: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const { model: primaryModel, systemPrompt, userMessage, imageUrls = [] } = options;

  // Fallback chain in case of model-specific infrastructure failures
  const fallbackModels: GeminiModel[] = [
    primaryModel,
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ].filter((m, i, arr) => arr.indexOf(m) === i) as GeminiModel[]; // deduplicate

  let lastError: any;

  for (const currentModel of fallbackModels) {
    let retries = 3;
    let delayMs = 2000;

    while (retries > 0) {
      try {
        console.log(`[GEMINI] Generating with ${currentModel} (Attempts left: ${retries})`);
        
        const geminiModel = genAI.getGenerativeModel({
          model: currentModel,
          ...(systemPrompt
            ? { systemInstruction: { role: "system", parts: [{ text: systemPrompt }] } }
            : {}),
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        });

        const parts: Part[] = [{ text: userMessage }];
        for (const url of imageUrls) {
          const imagePart = await urlToInlinePart(url);
          parts.push(imagePart);
        }

        const result = await geminiModel.generateContent({
          contents: [{ role: "user", parts }],
        });

        const response = result.response;
        const text = response.text();
        const usageMeta = response.usageMetadata;

        return {
          text,
          inputTokens: usageMeta?.promptTokenCount ?? 0,
          outputTokens: usageMeta?.candidatesTokenCount ?? 0,
        };
      } catch (error: any) {
        lastError = error;
        const status = error?.status || error?.response?.status;
        const isTransient = status === 503 || status === 429 || error?.message?.includes("503") || error?.message?.includes("429");

        if (isTransient) {
          console.warn(`[GEMINI] Transient error ${status || "503"} on ${currentModel}. Retrying in ${delayMs}ms...`);
          await new Promise((r) => setTimeout(r, delayMs));
          retries--;
          delayMs *= 2; // Exponential backoff
        } else {
          // If it's a permanent error (e.g. invalid key), don't retry this model
          break;
        }
      }
    }
    
    console.warn(`[GEMINI] Model ${currentModel} exhausted. Attempting next fallback...`);
  }

  throw lastError || new Error("Failed to generate content after multiple models and retries");
}
