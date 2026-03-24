const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
    console.log('Fetching available models...');
    try {
        const response = await ai.models.list();
        // The list() method returns a response that might be an array or have a models property
        const models = response.models || response;
        if (Array.isArray(models)) {
            console.log('Available Models:');
            models.forEach(m => {
                console.log(`- ${m.name} [Actions: ${m.supportedActions.join(', ')}]`);
            });
        } else {
            console.log('Unexpected response format:', JSON.stringify(response, null, 2));
        }
    } catch (error) {
        console.error('Error listing models:', error.message);
    }
}

listModels();
