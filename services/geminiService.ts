import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { DIYPlan } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts a File object to a Base64 string.
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Generates the DIY Plan (Text) using Gemini 3 Pro.
 */
export const generateDIYPlan = async (
  inspirationBase64: string,
  currentBase64: string,
  dimensions: string,
  styleAdjustments: string
): Promise<DIYPlan> => {
  
  const materialSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      quantity: { type: Type.STRING },
      estimatedCost: { type: Type.STRING },
      category: { type: Type.STRING, enum: ['tool', 'consumable', 'furniture', 'decor'] }
    },
    required: ['name', 'quantity', 'category']
  };

  const stepSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      stepNumber: { type: Type.INTEGER },
      title: { type: Type.STRING },
      instruction: { type: Type.STRING, description: "A high-level summary of the step." },
      substeps: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "A chronological list of specific, atomic actions required to complete this step. Be extremely detailed." 
      },
      safetyWarning: { 
        type: Type.STRING, 
        description: "Important safety warnings specific to this step (e.g., 'Turn off electricity', 'Wear safety goggles')." 
      },
      requiredTools: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of tools from the main material list that are specifically needed for this step."
      },
      tip: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
      estimatedTime: { type: Type.STRING },
      visualizationPrompt: { 
        type: Type.STRING, 
        description: "A highly detailed, photorealistic image generation prompt. It MUST explicitly describe the materials, colors, textures, and lighting from the 'Inspiration' image that apply to this step. It MUST also explicitly state to keep the structural geometry (windows, doors, ceiling height) of the 'Current State' image." 
      }
    },
    required: ['stepNumber', 'title', 'instruction', 'substeps', 'visualizationPrompt', 'difficulty', 'estimatedTime']
  };

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      projectTitle: { type: Type.STRING },
      description: { type: Type.STRING },
      styleAnalysis: { type: Type.STRING, description: "A concise summary of the Inspiration image's style (e.g., 'Mid-Century Modern with walnut wood tones, brass accents, and warm diffused lighting')." },
      difficultyLevel: { type: Type.STRING, enum: ['Beginner', 'Intermediate', 'Advanced'] },
      estimatedTime: { type: Type.STRING },
      estimatedTotalCost: { type: Type.STRING },
      materials: { type: Type.ARRAY, items: materialSchema },
      steps: { type: Type.ARRAY, items: stepSchema }
    },
    required: ['projectTitle', 'description', 'styleAnalysis', 'materials', 'steps']
  };

  const prompt = `
    You are an expert interior designer and DIY contractor.
    I have an 'Inspiration' image showing the look I want to achieve.
    I have a 'Current State' image showing my room right now.
    ${dimensions ? `The dimensions of the area are: ${dimensions}.` : ''}
    ${styleAdjustments ? `CRITICAL STYLE ADJUSTMENT requested by user: "${styleAdjustments}". You MUST modify the plan and the visual style to incorporate this adjustment, instead of blindly following the inspiration image.` : ''}

    Create a comprehensive, step-by-step DIY manual to transform the 'Current State' into the 'Inspiration' style (modified by any user adjustments).
    
    1. First, deeply ANALYZE the 'Inspiration' image. Identify the key style elements: Color Palette, Material Textures (wood, metal, fabric types), Lighting Quality, and Decor Aesthetic.
    2. List all necessary materials and tools.
    3. Break down the process into clear, actionable steps.
    4. CRITICAL: For each step, provide:
       - A summary 'instruction'.
       - A list of detailed 'substeps' that act as a checklist.
       - Any necessary 'safetyWarning'.
       - A list of 'requiredTools' for that specific step.
       - A 'visualizationPrompt' for an AI image generator. 
       
    The 'visualizationPrompt' MUST be extremely descriptive of the *visual style*.
       - Instead of "Add the sofa", write "Place a low-profile beige linen sofa with tufted cushions, matching the inspiration image style, into the room".
       - CRITICAL: The prompt MUST explicitly command the image generator to PRESERVE the room's structural geometry (walls, windows, floor plan) from the current state image.
       - Ensure the lighting and mood described in the prompt matches the Inspiration image (e.g., "warm sunset lighting", "cool clinical brights").
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { text: prompt },
        { 
          inlineData: {
            mimeType: 'image/jpeg',
            data: currentBase64
          }
        },
        { 
          inlineData: {
            mimeType: 'image/jpeg',
            data: inspirationBase64
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      thinkingConfig: { thinkingBudget: 4096 }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate plan");
  }

  return JSON.parse(response.text) as DIYPlan;
};

export interface GenerateStepImageOptions {
  lighting?: string;
  cameraAngle?: string;
}

/**
 * Helper to get mime type and clean base64 data
 */
const parseBase64 = (base64String: string) => {
  const mimeType = base64String.match(/^data:(image\/[a-zA-Z]+);base64,/)?.[1] || 'image/jpeg';
  const cleanData = base64String.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  return { mimeType, cleanData };
};

/**
 * Generates a visualization for a specific step using Nano Banana (Gemini 3 Pro Image).
 * Supports image editing if a reference image is provided to ensure consistency.
 */
export const generateStepImage = async (
  prompt: string, 
  referenceImageBase64?: string,
  options: GenerateStepImageOptions = {},
  previousContext: string = ""
): Promise<string> => {
  const parts: any[] = [];
  
  if (referenceImageBase64) {
    const { mimeType, cleanData } = parseBase64(referenceImageBase64);

    parts.push({
      inlineData: {
        mimeType: mimeType, 
        data: cleanData
      }
    });

    // Default to "Match Reference" logic unless overridden by options
    const lightingInstruction = options.lighting && options.lighting !== 'Match Reference'
      ? `LIGHTING: Apply ${options.lighting} lighting style, overriding the original if necessary but keeping shadows realistic.`
      : `LIGHTING: Adopt the lighting mood described in the prompt (if specified) or maintain the source lighting.`;

    const angleInstruction = options.cameraAngle && options.cameraAngle !== 'Match Reference'
      ? `CAMERA ANGLE: Re-imagine the scene from a ${options.cameraAngle} perspective (only if strictly necessary to visualize the step, otherwise prefer original angle).`
      : `PRESERVE GEOMETRY: Keep the EXACT same camera angle, perspective, and room dimensions as the original image.`;
    
    const contextInstruction = previousContext 
      ? `PREVIOUS CONTEXT: The input image represents the room after these previous steps: "${previousContext}". You must MAINTAIN these previous modifications unless this specific step explicitly requires changing them.`
      : "";

    parts.push({ 
      text: `Edit this specific room image to visualize the following DIY step: "${prompt}".
      
      CRITICAL INSTRUCTIONS:
      1. SPATIAL & STRUCTURAL INTEGRITY: The underlying room geometry (walls, ceiling, floor plan, window placement) MUST BE IDENTICAL to the source image. This is a renovation of the SAME room. Do NOT hallucinate new architecture or change the room layout unless the step is explicitly about demolition.
      2. STYLE FIDELITY: Strictly apply the colors, materials, and textures described in the prompt.
      3. ${angleInstruction}
      4. ${lightingInstruction}
      5. ${contextInstruction}
      6. REALISM: The output must be a photorealistic interior design progress shot.
      ` 
    });
  } else {
    // Fallback to text-to-image if no reference is passed
    const lightingText = options.lighting && options.lighting !== 'Match Reference' ? `, ${options.lighting} lighting` : ', bright natural lighting';
    const angleText = options.cameraAngle && options.cameraAngle !== 'Match Reference' ? `, ${options.cameraAngle} view` : '';

    parts.push({ text: `${prompt}. High quality, photorealistic, 4k, interior design photography style${lightingText}${angleText}. Ensure the style matches the described inspiration exactly.` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: parts
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }

  throw new Error("No image generated");
};

/**
 * Generates a variant of a completed room for the interactive studio.
 */
export const generateVariantImage = async (
  baseImageBase64: string,
  angle: string,
  lighting: string,
  styleContext: string
): Promise<string> => {
  const { mimeType, cleanData } = parseBase64(baseImageBase64);

  const parts = [
    {
      inlineData: {
        mimeType: mimeType,
        data: cleanData
      }
    },
    {
      text: `Edit this room image to show it from a ${angle} perspective with ${lighting} lighting.
      
      Instructions:
      1. RETAIN DESIGN: The furniture, wall colors, floor, and decor MUST remain exactly the same. This is the same room, just a different photo.
      2. PERSPECTIVE: Strictly adhere to the ${angle} view. 
         - If "Top-Down", show a plan view. 
         - If "Left/Right 45 degrees", rotate the camera around the center of the room.
         - If "Wide Angle", increase field of view while keeping context.
      3. LIGHTING: Strictly adhere to ${lighting}.
      4. STYLE: ${styleContext}
      5. OUTPUT: Photorealistic 4K render.`
    }
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Variant generation failed");
};

/**
 * Generates a high-quality product shot for a specific material.
 */
export const generateProductImage = async (
  productName: string,
  styleDescription: string
): Promise<string> => {
  const prompt = `A single ${productName} isolated on a plain white background. 
  Style: ${styleDescription}.
  High quality professional product photography, sharp focus, studio lighting.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  // Check for image part
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  
  const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
  if (textPart?.text) {
      console.warn("Gemini Image Generation Refusal/Text:", textPart.text);
  }

  throw new Error("No image generated");
};

/**
 * Generates a cinematic 3D tour video using Veo 3.1.
 */
export const generateRoomTourVideo = async (
  styleDescription: string,
  imageBase64: string
): Promise<string> => {
  // CRITICAL: Always create a NEW instance to capture the latest API Key if user just selected it.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const { cleanData } = parseBase64(imageBase64);

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic slow pan camera movement from left to right. Ultra wide angle lens to capture the full room context. ${styleDescription}. Photorealistic, 4k, highly detailed interior design, smooth motion.`,
    image: {
      imageBytes: cleanData,
      mimeType: 'image/jpeg', // Veo might be strict, but usually supports common types. 
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // Polling loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed");

  // Fetch with key
  const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// Helper for Audio Decoding
const base64ToArrayBuffer = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates an audio summary of the project plan using Gemini TTS.
 * Returns the raw ArrayBuffer of the audio.
 */
export const generateProjectSummaryAudio = async (plan: DIYPlan): Promise<ArrayBuffer> => {
   // Generate Script
   const text = `Here is your DIY Plan for: ${plan.projectTitle}. 
   This project involves ${plan.steps.length} key steps.
   ${plan.steps.map(s => `Step ${s.stepNumber}: ${s.title}. Essential note: ${s.instruction}.`).join(' ')}
   Congratulations on completing your transformation!`;

   const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep voice for narration
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  return base64ToArrayBuffer(base64Audio);
};

/**
 * Generates a specific night-time tour video.
 */
export const generateNightTourVideo = async (imageBase64: string): Promise<string> => {
    // New instance for key check
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { cleanData } = parseBase64(imageBase64);
    
    let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: 'Cinematic slow pan from left to right. Ultra-wide angle lens (14mm) capturing the entire room. The room is beautifully furnished with cozy living furniture including plush sofas and armchairs. Warm night lighting with ambient lamps. Relaxing, high-end interior design video. Photorealistic, 4k.',
    image: {
        imageBytes: cleanData,
        mimeType: 'image/jpeg',
    },
    config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
    }
    });

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed");

    const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}