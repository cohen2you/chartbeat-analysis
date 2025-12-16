'use client';

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface TrafficDataPoint {
  date: string;
  traffic: number;
  postCount: number;
  sp500?: number;
}

interface TrafficAnalysisChartProps {
  data: TrafficDataPoint[];
}

export default function TrafficAnalysisChart({ data }: TrafficAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">No data available for chart</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
        Traffic vs. Output vs. Market Performance
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart 
          data={data} 
          margin={{ 
            top: 20, 
            right: data.some(d => d.sp500 !== undefined) ? 100 : 30, 
            left: 20, 
            bottom: 5 
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            tick={{ fill: '#6b7280' }}
          />
          
          {/* Left Y-Axis: Traffic (Pageviews) */}
          <YAxis 
            yAxisId="left" 
            label={{ value: 'Pageviews', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#ff7300' } }}
            stroke="#ff7300"
            tick={{ fill: '#ff7300' }}
          />
          
          {/* Right Y-Axis: Articles Published */}
          <YAxis 
            yAxisId="right" 
            orientation="right"
            label={{ value: 'Articles Published', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#413ea0' } }}
            stroke="#413ea0"
            tick={{ fill: '#413ea0' }}
          />
          
          {/* Third Y-Axis: S&P 500 % (only if S&P 500 data exists) */}
          {data.some(d => d.sp500 !== undefined) && (
            <YAxis 
              yAxisId="sp500" 
              orientation="right"
              width={60}
              label={{ value: 'S&P 500 %', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#82ca9d' } }}
              stroke="#82ca9d"
              tick={{ fill: '#82ca9d' }}
              tickFormatter={(value) => `${value}%`}
            />
          )}
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#f9fafb', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
            formatter={(value: any, name: string | undefined): [string, string] => {
              const safeName = name || '';
              if (safeName === 'Pageviews') {
                const formattedValue = typeof value === 'number' 
                  ? value.toLocaleString() 
                  : String(value || '');
                return [formattedValue, safeName];
              }
              if (safeName === 'S&P 500 %') {
                const formattedValue = typeof value === 'number' 
                  ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` 
                  : `${value || ''}%`;
                return [formattedValue, safeName];
              }
              return [String(value || ''), safeName];
            }}
          />
          <Legend />

          {/* Articles Published - Bar Chart */}
          <Bar 
            yAxisId="right" 
            dataKey="postCount" 
            barSize={20} 
            fill="#413ea0" 
            name="Articles Published"
            radius={[4, 4, 0, 0]}
          />
          
          {/* Traffic - Line Chart */}
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="traffic" 
            stroke="#ff7300" 
            strokeWidth={3} 
            name="Pageviews"
            dot={{ fill: '#ff7300', r: 4 }}
            activeDot={{ r: 6 }}
          />
          
          {/* S&P 500 - Dashed Line on separate axis */}
          {data.some(d => d.sp500 !== undefined) && (
            <Line 
              yAxisId="sp500" 
              type="monotone" 
              dataKey="sp500" 
              stroke="#82ca9d" 
              strokeDasharray="5 5" 
              strokeWidth={2}
              name="S&P 500 %"
              dot={{ fill: '#82ca9d', r: 3 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

