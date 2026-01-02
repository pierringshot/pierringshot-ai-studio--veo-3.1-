import { GoogleGenAI, Type, Modality } from "@google/genai";

export type RetryCallback = (id: string, delay: number) => void;

export class GeminiService {
  private static onRetryListeners: Set<RetryCallback> = new Set();

  static subscribeToRetries(cb: RetryCallback) {
    this.onRetryListeners.add(cb);
    return () => { this.onRetryListeners.delete(cb); };
  }

  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private static async withRetry<T>(fn: () => Promise<T>, id: string = 'global', retries = 10): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        if (i === retries - 1) throw e;
        
        let isQuota = false;
        let retryDelayFromError = 0;

        // Normalize error parts to handle different structures (Error object vs JSON string)
        const status = e.status || e.code || e.error?.code || e.error?.status;
        const message = e.message || JSON.stringify(e);
        
        // Check for 429/Resource Exhausted
        if (
            status === 429 || 
            status === 'RESOURCE_EXHAUSTED' || 
            (typeof message === 'string' && (
                message.includes("429") || 
                message.includes("Quota exceeded") || 
                message.includes("RESOURCE_EXHAUSTED")
            ))
        ) {
            isQuota = true;
        }

        // Try to parse detailed retry info from the error object or message
        try {
            let errorObj = e;
            // If message is a JSON string (common in some Google API errors), parse it
            if (typeof message === 'string' && message.trim().startsWith('{')) {
                 try {
                    const parsed = JSON.parse(message);
                    if (parsed.error) errorObj = parsed;
                 } catch {}
            }

            // Look for google.rpc.RetryInfo in details array
            const details = errorObj.error?.details || errorObj.details;
            if (Array.isArray(details)) {
                const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo'));
                if (retryInfo?.retryDelay) {
                    const s = parseFloat(retryInfo.retryDelay.replace('s', ''));
                    if (!isNaN(s)) retryDelayFromError = Math.ceil(s * 1000);
                }
            }
        } catch (parseError) {
            // ignore parsing errors
        }
        
        // Fallback: Regex extraction from message string "Please retry in 57.12s."
        if (!retryDelayFromError && typeof message === 'string') {
             const match = message.match(/retry in ([0-9.]+)s/);
             if (match) {
                 retryDelayFromError = Math.ceil(parseFloat(match[1]) * 1000);
             }
        }

        if (!isQuota) throw e;

        // Calculate final delay
        let delay = 0;
        if (retryDelayFromError > 0) {
            delay = retryDelayFromError + 2000; // Add 2s safety buffer
        } else {
            // Exponential backoff if no specific time given
            delay = Math.min(60000, 5000 * Math.pow(2, i)); 
        }

        this.onRetryListeners.forEach(cb => cb(id, delay));
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  static async getTrendingTopics(): Promise<{title: string, description: string, relevance: string}[]> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Identify 4 top trending cybersecurity threats or digital privacy topics relevant to Azerbaijan and the Caspian region right now. 
        Focus on high-engagement issues like:
        - WhatsApp/Instagram hacks popular in Baku.
        - Phishing scams targeting local banks (Kapital, ABB).
        - VPN usage and privacy in Azerbaijan.
        - State-sponsored threats or regional cyber warfare.

        Return a JSON array where each object has:
        - title: A short, punchy title mixing Azerbaijani slang and English (e.g., "WhatsApp Sındırıldı?").
        - description: Brief context in English.
        - relevance: Why it matters to a "qaqa" in Baku.
        `,
        config: {
          tools: [{googleSearch: {}}],
          responseMimeType: "application/json"
        }
      });
      
      let text = response.text || "[]";
      // Clean potential markdown blocks
      if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '');
      else if (text.startsWith('```')) text = text.replace(/```/g, '');
      
      return JSON.parse(text);
    }, 'topic-scan');
  }

    static async generateScript(topic: string, model: string = 'gemini-3-pro-preview'): Promise<string> {

      if (topic === "RƏQƏMSAL KÖLGƏLƏR") {

        const preDefinedScript = {

          "topic": "RƏQƏMSAL KÖLGƏLƏR",

          "segments": [

            {

              "id": "1",

              "title": "CHAPTER #1: THE HOOK",

              "timeRange": "00:00 - 00:15",

              "visualPrompt": "Tam qara ekran. Ortada bir kursor yanıb-sönür. Qəfil qırmızı glitch: SYSTEM_FAILURE.",

              "audioSfx": "Ağır bass vuruşu. Mexaniki klaviatura səsi: Tıq-tıq-tıq...",

              "voicemail": "Sən elə bilirsən ki... telefonundakı o şüşə səni dünyadan qoruyur? Elə bilirsən hər şey \"ok\"dur, qaqa? Yox... Sən sadəcə bu sistemin içində bir rəqəmsən. Və bu gün... o rəqəmi silməyə gəliblər. Gözünü aç, brat... yoxsa səni sağmal inək kimi sağacaqlar."

            },

            {

              "id": "2",

              "title": "CHAPTER #2: THE REVEAL",

              "timeRange": "00:15 - 00:45",

              "visualPrompt": "Ekranda WhatsApp logosu. Logo qırmızıya boyanır və 'əriyərək' bir koda çevrilir: exploit.py --target=you. Terminalda sürətlə loglar axır.",

              "audioSfx": "",

              "voicemail": "Bax, bu \"Zəli\" taktikasıdır. 2025-in ən böyük teması. Onlar sənin telefonuna sızmırlar, brat. Onlar sənin beyninə sızırlar. Bir dənə mesaj gəlir: \"Qardaş, başım dərddədir, bu linkə bas səs ver\". Vəssalam. Sən o linkə basan anda... rəqəmsal kəfənin tikilməyə başlayır. Sənin \"dostun\" sənə səs atır, amma o səs süni intellektin oyuncağıdır. Sənin etibarını götürüb, kartını boşaldırlar."

            },

            {

              "id": "3",

              "title": "CHAPTER #3: THE IMPACT",

              "timeRange": "00:45 - 01:10",

              "visualPrompt": "Ekranda bir bank kartı şəkli. Üstündəki rəqəmlər bir-bir sıfıra çevrilir. Sürətli montaj: panikada olan insanların kölgələri. ALERT RED rəngində yazı: BALANCE: 0.00 AZN.",

              "audioSfx": "",

              "voicemail": "Nəticə? Sənin aylarla qul kimi işləyib yığdığın pul... bir neçə saniyəyə hansısa otaqda oturan bir parazitin cibinə gedir. Şəxsiyyətin oğurlanır, adın ləkələnir. Sən artıq bir \"insan\" deyilsən, sən sadəcə fırladılmış bir \"peysər\"sən. Acı reallıq budur."

            },

            {

              "id": "4",

              "title": "CHAPTER #4: THE SHIELD",

              "timeRange": "01:10 - 01:40",

              "visualPrompt": "Rənglər qəfil SIGNAL WHITE və ELECTRIC BLUE-ya çevrilir. Ekranda təmiz, texnik sxemlər peyda olur. 2FA, Encryption, Zero Trust sözləri qalın şriflərlə çıxır.",

              "audioSfx": "",

              "voicemail": "Amma... İdarəetmə səndədir. Əgər ov olmaq istəmirsənsə, ovçu olmağı öyrənəcəksən. Bir: Heç kimə inanma. Hətta qardaşın zəng eləsə belə, gizli sualını soruş. İki: O zibil linklərə basma. Marağın sənin qatilin olmasın. Üç: İkiqat qorumanı (2FA) aktiv elə. Sistem səni izləyir, amma sən ondan bir addım öndə olmalısan."

            },

            {

              "id": "5",

              "title": "CHAPTER #5: THE OUTRO",

              "timeRange": "01:40 - 01:50",

              "visualPrompt": "An0n Ali logosu (Kəllə və Qıfıl). Ekranda tək bir cümlə: \"SECURITY IS AN ILLUSION.\"",

              "audioSfx": "Geiger counter səsi sürətlənir və kəsilir.",

              "voicemail": "Ayıq ol, qaqa. Bu kiber-cəhənnəmdə ya ovçusan, ya da ov. Mən çıxdım."

            }

          ]

        };

        return JSON.stringify(preDefinedScript);

      }

      return this.withRetry(async () => {

        const ai = this.getAI();

        const response = await ai.models.generateContent({

          model: model,

          contents: `Write a professional cybersecurity educational script for the 'An0n Ali' channel on the topic: "${topic}".

          

          BRAND PHILOSOPHY (v2.0):

          - Motto: "Security is an Illusion. Control is a Choice."

          - Tone: Educational, Ominous, Precise, Authoritative. No hype.

          - Structure: The Hook (Illusion) -> The Kill Chain (Reality) -> The Shield (Fortification).

  

          VISUAL REQUIREMENTS (Strictly for 'visualPrompt' field):

          - Aesthetic: Cinematic Cyberpunk Noir, High Contrast,

          Void Black background, Neon Red accents (#FF0000).

          - Elements: Retro Terminal aesthetic, Glitch artifacts, Scanlines, Minimalist iconography (Skull, Lock, Data), Neon-drenched alleyways.

          - Motion: Typewriter text reveal, subtle camera drift, digital noise, datamoshing transitions.

          

          OUTPUT FORMAT (JSON):

          {

            "topic": "${topic}",

            "segments": [

              {

                "id": "1",

                "title": "CHAPTER #1: [TITLE]",

                "timeRange": "00:00 - 00:30",

                "visualPrompt": "Cinematic Cyberpunk Noir, High Contrast, Void Black background... [Specific Scene Details]",

                "audioSfx": "Mechanical Keyboard Clicks synced with Typewriter effect, Low-tempo Lo-Fi Synth Drone...",

                "voicemail": "Azərbaycan dilində, avtoritar, sakit və texniki dildə... [Script text]"

              }

            ]

          }`,

          config: {

            responseMimeType: "application/json",

            responseSchema: {

              type: Type.OBJECT,

              properties: {

                topic: { type: Type.STRING },

                segments: {

                  type: Type.ARRAY,

                  items: {

                    type: Type.OBJECT,

                    properties: {

                      id: { type: Type.STRING },

                      title: { type: Type.STRING },

                      timeRange: { type: Type.STRING },

                      visualPrompt: { type: Type.STRING },

                      audioSfx: { type: Type.STRING },

                      voicemail: { type: Type.STRING }

                    },

                    required: ["id", "title", "timeRange", "visualPrompt", "audioSfx", "voicemail"]

                  }

                }

              },

              required: ["topic", "segments"]

            }

          }

        });

  

        return response.text || "";

      }, 'script-gen');

    }

  static async generateThumbnail(prompt: string, segmentId: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      // Enforcing strict brand aesthetics for static imagery
      const brandStyle = "Cinematic Cyberpunk Noir, High Contrast, Void Black background, Neon Red accents, Retro Terminal aesthetic, subtle intermittent datamosh, digital glitch effects";
      
      // Using gemini-2.5-flash-image (Nano Banana) for fast keyframing
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{
            text: `${brandStyle}. Subject: ${prompt}.`,
          }],
        },
        config: { imageConfig: { aspectRatio: "16:9" } },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
      throw new Error("Thumbnail generation failed.");
    }, `keyframe-${segmentId}`);
  }

  static async generateVideo(
    prompt: string, 
    segmentId: string,
    resolution: '720p' | '1080p' = '720p', 
    aspectRatio: '16:9' | '9:16' = '16:9', 
    fps: string = '24',
    image?: { imageBytes: string, mimeType: string },
    model: 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview' = 'veo-3.1-fast-generate-preview'
  ): Promise<string> {
    const ai = this.getAI();
    
    // Strict An0n Ali v2.0 Brand injection for VEO, including specified motion behaviors
    const brandTokens = "Cinematic Cyberpunk Noir, High Contrast, Void Black background, Neon Red accents, Retro Terminal aesthetic";
    const motionTokens = "subtle intermittent datamosh, digital glitch effects, ultra-smooth motion interpolation";
    
    const enhancedPrompt = `${prompt.trim()}. ${brandTokens}. ${motionTokens}.`;
    
    const request: any = {
      model: model,
      prompt: enhancedPrompt,
      config: { numberOfVideos: 1, resolution, aspectRatio }
    };

    if (image) request.image = image;
    
    let operation = await this.withRetry(async () => {
        return await ai.models.generateVideos(request);
    }, `video-${segmentId}`);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      try {
        operation = await ai.operations.getVideosOperation({ operation });
      } catch (e) {
        console.warn("Polling warning:", e);
      }
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed.");
    const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  }

  static async generateSpeech(text: string, segmentId: string, speed: number = 1.0, pitch: 'low' | 'normal' | 'high' = 'low'): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ 
          parts: [{ 
            text: `
            SYSTEM_INSTRUCTION: ACTIVATE 'KAIN' PROTOCOL.
            
            IDENTITY: You are KAIN. A cyber-anarchist from Baku.
            VOICE_PROFILE: Deep, Authoritative, Resonant. (Reference: Stable, Low-Volatility, Noir Narrator).
            LANGUAGE: Azerbaijani (Bakı dialekti) mixed with English technical terms.
            
            PERFORMANCE_GUIDELINES:
            1.  **PACING**: Speak slowly and deliberately. Respect ellipses (...) as full dramatic pauses.
            2.  **TONE**: Ominous, Cynical, Cold. Maintain 35% stability - monotone but dangerous. No enthusiasm.
            3.  **VOCABULARY**: Use street slang naturally ("Brat", "Qaqa", "Tema", "Sistem").
            4.  **EMPHASIS**: Hit CAPITALIZED words with force. They are the punchline.
            
            TEXT_TO_SPEAK:
            "${text}"
            ` 
          }] 
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Audio generation failed.");
      return base64Audio;
    }, `voice-${segmentId}`);
  }
}