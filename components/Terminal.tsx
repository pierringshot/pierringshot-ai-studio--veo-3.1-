
import React, { useState, useEffect, useRef } from 'react';

interface TerminalProps {
  logs: string[];
  title?: string;
}

const Terminal: React.FC<TerminalProps> = ({ logs, title = "SYSTEM_LOG" }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black border border-[#00FF00]/30 rounded-none overflow-hidden flex flex-col h-full shadow-[0_0_15px_rgba(0,255,0,0.05)]">
      <div className="bg-[#001100] px-3 py-1 flex justify-between items-center border-b border-[#00FF00]/20">
        <span className="text-[#00FF00] font-pixel text-xl tracking-widest uppercase">{title}</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-[#00FF00] opacity-50"></div>
          <div className="w-2 h-2 bg-[#00FF00] opacity-30"></div>
          <div className="w-2 h-2 bg-[#00FF00] opacity-10"></div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="p-4 overflow-y-auto flex-1 space-y-1 custom-scrollbar bg-black font-mono text-sm leading-tight"
      >
        {logs.map((log, i) => {
          const isError = log.startsWith('ERR') || log.includes('FAILURE') || log.includes('CRITICAL');
          const isSignal = log.startsWith('SIGNAL') || log.startsWith('WARN');
          const isSystem = log.startsWith('SYSTEM');
          
          return (
            <div key={i} className="flex gap-3 hover:bg-[#00FF00]/5 leading-tight">
              <span className="text-[#005500] shrink-0 select-none font-pixel text-base pt-0.5">
                {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
              </span>
              <span className={`break-all ${
                isError ? 'text-[#FF0000]' : 
                isSignal ? 'text-[#FACC15]' : 
                isSystem ? 'text-[#00A8FF]' : 
                'text-[#00FF00]'
              }`}>
                {log.startsWith('>') ? log : `> ${log}`}
              </span>
            </div>
          );
        })}
        <div className="mt-2 flex items-center gap-2">
            <span className="text-[#00FF00]">$</span>
            <div className="w-3 h-5 bg-[#00FF00] animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;
