
import React from 'react';
import { VISUAL_ASSETS, Asset } from '../constants/assets.js';

interface AssetLibraryProps {
  onSelect: (asset: Asset) => void;
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ onSelect }) => {
  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] text-gray-500 uppercase tracking-widest font-pixel">ASSET_INJECTION_MODULE</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {VISUAL_ASSETS.map(asset => (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className="group flex flex-col items-center justify-center p-1.5 border border-white/10 hover:border-red-600 hover:bg-white/5 transition-all bg-black"
            title={asset.prompt}
          >
             <span className="text-lg mb-1 group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">{asset.icon}</span>
             <span className="text-[7px] text-gray-500 group-hover:text-white uppercase font-mono tracking-tighter">{asset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AssetLibrary;
