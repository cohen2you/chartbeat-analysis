# Chartbeat Analysis

A web application for analyzing CSV data and generating AI-powered key takeaways to help editors make data-driven decisions.

## Features

- **Single CSV Analysis**: Paste or upload a single CSV file to get detailed insights
- **Multiple CSV Comparison**: Compare multiple datasets side-by-side to identify patterns and differences
- **AI-Powered Analysis**: Uses OpenAI's GPT-4 to provide intelligent, actionable takeaways
- **Editor-Friendly Output**: Structured results with key takeaways, insights, and recommendations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

1. Clone or navigate to the project directory:
```bash
cd chartbeat-analysis
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_actual_api_key_here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Input Data**: 
   - Paste CSV content directly into the text area, or
   - Click "Upload CSV File" to select a file from your computer

2. **Multiple Datasets**: 
   - Click "Add Another Dataset" to compare multiple CSV files
   - Each dataset can be pasted or uploaded independently

3. **Analyze**: 
   - Click "Analyze Data" to process your CSV(s)
   - Wait for the AI to generate insights (this may take a few seconds)

4. **Review Results**: 
   - Key Takeaways: Bullet points highlighting the most important findings
   - Detailed Insights: Comprehensive analysis of the data
   - Recommendations: Actionable suggestions (when applicable)

## Technology Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Modern, responsive styling
- **OpenAI API**: GPT-4 for data analysis
- **PapaParse**: CSV parsing library

## Project Structure

```
chartbeat-analysis/
├── app/
│   ├── api/analyze/      # API route for data analysis
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page component
├── components/
│   ├── CSVInput.tsx      # CSV input component
│   └── AnalysisResults.tsx # Results display component
├── lib/
│   ├── csvParser.ts      # CSV parsing utilities
│   └── openai.ts         # OpenAI API integration
└── package.json
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Notes

- The app uses GPT-4 Turbo for analysis. Make sure you have API credits available.
- Large CSV files may take longer to process.
- The analysis quality depends on the structure and clarity of your CSV data.

