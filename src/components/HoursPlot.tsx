import { useReducedMotion } from 'motion/react';
import { EChartsLineChart, type ChartConfig } from './evilcharts/charts/echarts-line-chart.tsx';
import type { WorkHoursPoint } from '../chartData.ts';

const chartConfig = {
  minutes: { label: 'Deep work (minutes)', colors: { light: ['var(--positive)'], dark: ['var(--positive)'] } },
} satisfies ChartConfig;

export default function HoursPlot({ points, compact }: { points: WorkHoursPoint[]; compact: boolean }) {
  const reduced = useReducedMotion();
  return <EChartsLineChart data={points} config={chartConfig} renderer="svg" xDataKey="day"
    className={'antwork-chart' + (compact ? ' antwork-chart-compact' : '')}
    curveType="smooth" animation={!reduced}>
    <EChartsLineChart.Grid />
    <EChartsLineChart.XAxis dataKey="day" tickFormatter={(value, index) =>
      compact || index === 0 || index === points.length - 1 || index % 5 === 0
        ? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''} />
    {!compact && <EChartsLineChart.YAxis tickFormatter={value => (Math.round(value / 6) / 10) + 'h'} />}
    <EChartsLineChart.Tooltip />
    <EChartsLineChart.Line dataKey="minutes" strokeWidth={2} areaOpacity={0.13}>
      {compact && <EChartsLineChart.Dot variant="border" />}
      <EChartsLineChart.ActiveDot variant="colored-border" />
    </EChartsLineChart.Line>
  </EChartsLineChart>;
}
