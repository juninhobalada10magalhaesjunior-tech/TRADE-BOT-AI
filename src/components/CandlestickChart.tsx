import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts';

interface CandlestickChartProps {
  data: {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  trades?: {
    timestamp: string;
    type: 'BUY' | 'SELL';
    entry_price: number;
    strategy: string;
    symbol: string;
  }[];
  gridLevels?: {
    price: number;
    type: 'BUY' | 'SELL';
    status: 'PENDING' | 'ACTIVE';
  }[];
  selectedSymbol: string;
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

export const CandlestickChart: React.FC<CandlestickChartProps> = (props) => {
  const {
    data,
    trades = [],
    gridLevels = [],
    selectedSymbol,
    colors: {
      backgroundColor = '#0A0A0A',
      textColor = '#D1D4DC',
    } = {},
  } = props;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.05)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 320,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      seriesRef.current = null;
      chartRef.current = null;
      priceLinesRef.current = [];
    };
  }, [backgroundColor, textColor]);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: CandlestickData[] = data.map((item) => ({
        time: (new Date(item.timestamp).getTime() / 1000) as any,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      })).sort((a, b) => (a.time as number) - (b.time as number));

      // Remove duplicates by time (lightweight-charts requirement)
      const uniqueData = formattedData.filter((value, index, self) =>
        index === self.findIndex((t) => t.time === value.time)
      );

      seriesRef.current.setData(uniqueData);

      // Set markers for trades
      if (seriesRef.current && typeof seriesRef.current.setMarkers === 'function') {
        const markers = trades
          .filter(t => t.symbol === selectedSymbol)
          .map(t => ({
            time: (new Date(t.timestamp).getTime() / 1000) as any,
            position: t.type === 'BUY' ? 'belowBar' : 'aboveBar' as any,
            color: t.type === 'BUY' ? '#22c55e' : '#ef4444', // Vibrant green and red
            shape: t.type === 'BUY' ? 'arrowUp' : 'arrowDown' as any,
            text: `${t.type === 'BUY' ? 'BUY' : 'SELL'}: ${t.strategy}`,
            size: 2,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        seriesRef.current.setMarkers(markers);
      }

      // Draw Grid Levels
      if (seriesRef.current) {
        // Clear old lines
        priceLinesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
        priceLinesRef.current = [];

        gridLevels.forEach(level => {
          const line = seriesRef.current?.createPriceLine({
            price: level.price,
            color: level.type === 'BUY' ? '#22c55e' : '#ef4444',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: `GRID ${level.type} (${level.status})`,
          });
          if (line) priceLinesRef.current.push(line);
        });
      }
    }
  }, [data, trades, gridLevels, selectedSymbol]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
