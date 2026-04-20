import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log("Available models:", data.models?.map((m: any) => m.name) || data);
}
run();
