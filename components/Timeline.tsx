
import React, { useMemo } from 'react';
import { ScriptSegment } from '../types';

interface TimelineProps {
  segments: ScriptSegment[];
  onSelectSegment: (id: string) => void;
  activeSegmentId?: string | null;
}

const Timeline: React.FC<TimelineProps> = ({ segments, onSelectSegment, activeSegmentId }) => {
  const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };

  const timelineData = useMemo(() => {
    if (segments.length === 0) return { totalSeconds: 0, items: [] };

    const items = segments.map(seg => {
      const [startStr, endStr] = seg.timeRange.split(' - ');
      const start = parseTimeToSeconds(startStr);
      const end = parseTimeToSeconds(endStr);
      return {
        id: seg.id,
        start,
        end,
        duration: end - start,
        title: seg.title
      };
    });

    const maxEnd = Math.max(...items.map(i => i.end));
    return { totalSeconds: maxEnd, items };
  }, [segments]);

  if (segments.length === 0) return null;

  return (
    <div className="bg-[#050505] border border-white/20 p-4 rounded-none mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-header text-white uppercase tracking-widest">TEMPORAL_MAP</span>
        <span className="text-xs font-mono text-gray-500">T-MINUS: {Math.floor(timelineData.totalSeconds / 60)}:{(timelineData.totalSeconds % 60).toString().padStart(2, '0')}</span>
      </div>
      
      <div className="relative h-12 bg-white/5 border border-white/10 flex">
        {timelineData.items.map((item, idx) => {
          const widthPercent = (item.duration / timelineData.totalSeconds) * 100;
          const isActive = activeSegmentId === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSelectSegment(item.id)}
              className={`relative h-full border-r border-black/50 transition-all group overflow-hidden ${
                isActive ? 'bg-white text-black' : 'bg-transparent text-gray-500 hover:text-white hover:bg-white/10'
              }`}
              style={{ width: `${widthPercent}%` }}
              title={`${item.title} (${item.start}s - ${item.end}s)`}
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20"></div>
              
              <div className="flex flex-col items-center justify-center h-full">
                <span className={`font-pixel text-xl ${isActive ? 'text-black' : 'text-gray-500 group-hover:text-white'}`}>
                  {idx + 1}
                </span>
              </div>
              
              {isActive && <div className="absolute bottom-0 w-full h-1 bg-red-600 shadow-[0_0_10px_red]"></div>}
            </button>
          );
        })}
      </div>
      
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[10px] text-gray-600 font-mono">00:00</span>
        <span className="text-[10px] text-gray-600 font-mono">END_SEQ</span>
      </div>
    </div>
  );
};

export default Timeline;
