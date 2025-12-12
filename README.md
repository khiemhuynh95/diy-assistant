# DIY Visionary Assistant

**DIY Visionary Assistant** is a next-generation interior design web application that empowers users to transform their living spaces using multimodal AI. By analyzing a photo of a current room and an inspiration image, the application generates a comprehensive, step-by-step DIY manual complete with photorealistic visualizations of every stage of the renovation.

## 🚀 Key Features

*   **Multimodal Analysis**: Upload your current room state and an inspiration image. The AI analyzes geometry, lighting, texture, and style to create a feasible transformation plan.
*   **Intelligent Planning**: Generates a detailed project manifest including material lists, estimated costs, safety warnings, and chronological instructions.
*   **Budget Control**: Users can specify a preferred budget (e.g., "$500", "Low Cost"). The AI attempts to select materials and methods to fit this constraint, or intelligently defaults to a "Best Value" strategy if the budget is unrealistic for the desired outcome.
*   **Progressive Visualization**: unlike standard image generators, this app visualizes *specific steps* (e.g., "Step 3: Painting the walls") while maintaining the structural integrity of your original room using Context-Aware Image Generation.
*   **Material Product Shots**: Generate high-quality studio product images for any tool or material listed in the plan.
*   **Audio Transformation Summary**: Creates a synchronized slideshow of your project steps with an AI-narrated voiceover summary.
*   **Cinematic Video Tours**: Generates photorealistic 4K video tours of the final result using Google's Veo video generation model, featuring specific camera movements and lighting conditions (e.g., Cozy Night Tour).

## 🧠 AI Models Used

This application leverages the full suite of **Google Gemini APIs** via the `@google/genai` SDK:

*   **Planning Logic**: `gemini-3-pro-preview` (Complex reasoning for structural planning and estimation).
*   **Image Generation**: `gemini-3-pro-image-preview` (High-fidelity image generation for step visualization and product shots).
*   **Video Generation**: `veo-3.1-fast-generate-preview` (Cinematic video generation for room tours).
*   **Text-to-Speech**: `gemini-2.5-flash-preview-tts` (Natural voice generation for project summaries).

## 🛠️ Tech Stack

*   **Frontend**: React (TypeScript)
*   **Styling**: Tailwind CSS
*   **AI Integration**: Google GenAI SDK
*   **Utilities**: `html2pdf.js` for PDF export

## 📋 How to Use

1.  **Upload**: Select a photo of your room ("Current State") and a photo of the style you want ("Inspiration").
2.  **Configure**:
    *   (Optional) Enter room dimensions.
    *   (Optional) Add custom style notes (e.g., "More minimalist").
    *   (Optional) **Set a Budget Preference** (e.g. "$1000", "Luxury").
3.  **Generate Plan**: Click "Generate My DIY Plan". The AI will architect a custom guide.
4.  **Visualize Steps**: The app will automatically generate progress images for each step, maintaining the perspective of your original room.
5.  **Interactive Studio**:
    *   Click on materials to see generated product shots.
    *   Edit specific substeps if you want to customize the plan.
    *   Adjust lighting/angles for specific visualizations.
6.  **Complete Project**:
    *   Listen to the **Audio Summary**.
    *   Watch the **Night Tour Video**.
    *   **Download PDF** or **Print** the manual for offline use.

---

*Powered by Google Gemini*