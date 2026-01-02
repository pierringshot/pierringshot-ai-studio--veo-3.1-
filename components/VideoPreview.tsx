import React from 'react';

interface VideoPreviewProps {
  url: string | null;
  onClose: () => void;
  title?: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ url, onClose, title = "SIGNAL_FEED" }) => {
  const isImage = url ? (url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(url)) : false;

  if (!url) {
    return (
      <div className="aspect-video bg-black border border-white/10 flex items-center justify-center flex-col p-4 text-center group relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiAvPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMzMzIiAvPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
        <div className="z-10 flex flex-col items-center">
            <div className="w-16 h-16 border border-white/20 rounded-none mb-4 flex items-center justify-center group-hover:border-red-600 transition-colors">
                <div className="w-2 h-2 bg-red-600 animate-pulse"></div>
            </div>
            <span className="text-xs font-pixel text-gray-500 uppercase tracking-[0.2em] group-hover:text-red-600 transition-colors">AWAITING_UPLINK</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-video bg-black border border-red-600 shadow-[0_0_0_1px_rgba(255,0,0,0.5)] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent z-10 flex justify-between items-start p-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/80 px-2 py-1 border border-red-900/50 pointer-events-auto">
          <div className="w-1.5 h-1.5 bg-red-600 animate-pulse"></div>
          <span className="text-[10px] text-red-500 font-header uppercase tracking-wider">{title}</span>
        </div>
        <button 
          onClick={onClose} 
          className="bg-red-600 text-white hover:bg-white hover:text-black transition-colors text-[10px] font-bold px-2 py-0.5 pointer-events-auto font-header"
          title="TERMINATE FEED"
        >
          CLOSE
        </button>
      </div>
      
      {isImage ? (
        <img 
          src={url} 
          className="w-full h-full object-contain bg-black"
          alt="Preview"
        />
      ) : (
        <video 
          src={url} 
          controls 
          className="w-full h-full object-cover"
          autoPlay
          loop
        />
      )}
      
      <div className="absolute bottom-4 left-4 pointer-events-none z-10">
        <div className="text-[10px] font-pixel text-white bg-black/80 px-2 border-l-2 border-red-600 tracking-widest">
          {isImage ? 'STATIC_IMAGE_DECRYPTED' : 'LIVE_STREAM_DECRYPTED'}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none box-border border-[1px] border-red-600/0 group-hover:border-red-600/20 transition-all duration-300"></div>
      
      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-red-600"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-red-600"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-red-600"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-red-600"></div>
    </div>
  );
};

export default VideoPreview;