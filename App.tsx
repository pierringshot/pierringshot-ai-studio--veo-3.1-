import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GeminiService } from './services/geminiService.js';
import { ScriptData, AppState, ScriptSegment, ViewMode } from './types.js';
import Terminal from './components/Terminal.js';
import VideoPreview from './components/VideoPreview.js';
import Timeline from './components/Timeline.js';
import AssetLibrary from './components/AssetLibrary.js';

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getAiStudio = () => (window as any).aistudio;

const App = () => {
  const [appState, setAppState] = useState<AppState>(AppState.START);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO);
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState<ScriptData | null>(null);
  const [logs, setLogs] = useState<string[]>(['SYSTEM_BOOT_COMPLETE', 'READY_FOR_DEPLOYMENT...']);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p'>('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [selectedFps, setSelectedFps] = useState<string>('24');
  const [selectedVeoModel, setSelectedVeoModel] = useState<'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview'>('veo-3.1-fast-generate-preview');
  const [selectedScriptModel, setSelectedScriptModel] = useState<'gemini-3-pro-preview' | 'gemini-3-flash-preview'>('gemini-3-pro-preview');
  
  const [activeTimelineSegmentId, setActiveTimelineSegmentId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Record<string, number>>({});

  // Codex / Trending Topics
  const [trendingTopics, setTrendingTopics] = useState<{title: string, description: string, relevance: string}[]>([]);
  const [scanningTopics, setScanningTopics] = useState(false);

  // Automation States
  const [isAutomating, setIsAutomating] = useState(false);
  const [autoSequencingId, setAutoSequencingId] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);
  const [isMasterSequencing, setIsMasterSequencing] = useState(false);
  const abortMasterSequence = useRef(false);

  // Generation States
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [generatingKeyframeId, setGeneratingKeyframeId] = useState<string | null>(null);
  
  const [synthesizedBuffers, setSynthesizedBuffers] = useState<Record<string, AudioBuffer>>({});
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Image Upload Refs and State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSegmentId, setUploadingSegmentId] = useState<string | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    const unsub = GeminiService.subscribeToRetries((id, delay) => {
      addLog(`SIGNAL_DEGRADATION: Quota reached for [${id}]. Backing off for ${Math.ceil(delay/1000)}s...`);
      setRetryingIds(prev => ({ ...prev, [id]: Date.now() + delay }));
      setTimeout(() => {
        setRetryingIds(prev => {
           const next = {...prev};
           delete next[id];
           return next;
        });
      }, delay);
    });
    return unsub;
  }, []);

  // Topic Scanning Effect
  useEffect(() => {
    if (viewMode === ViewMode.CODEX && trendingTopics.length === 0 && !scanningTopics) {
      scanForTopics();
    }
  }, [viewMode]);

  const scanForTopics = async () => {
    setScanningTopics(true);
    addLog('CODEX_SCAN: Intercepting regional signals...');
    try {
      const topics = await GeminiService.getTrendingTopics();
      setTrendingTopics(topics);
      addLog(`CODEX_SCAN: ${topics.length} threat vectors identified.`);
    } catch (e: any) {
      addLog(`CODEX_ERR: ${formatError(e)}`);
    } finally {
      setScanningTopics(false);
    }
  };

  const handleDeployTopic = async (selectedTopic: {title: string, description: string}) => {
    setViewMode(ViewMode.STUDIO);
    setTopic(selectedTopic.title);
    
    setIsAutomating(true);
    setLoading(true);
    addLog(`INIT_DEPLOY: ${selectedTopic.title.toUpperCase()} [AUTO_MODE]`);

    try {
      const scriptJson = await GeminiService.generateScript(`${selectedTopic.title} - Context: ${selectedTopic.description}. Ensure Azerbaijani perspective.`, selectedScriptModel);
      const parsed: ScriptData = JSON.parse(scriptJson);
      setScript(parsed);
      setAppState(AppState.EDITOR);
      addLog('SCRIPT_COMPILED: MISSION_PARAMETERS_LOCKED');
    } catch (err: any) {
      addLog(`CRITICAL_FAILURE: ${formatError(err)}`);
    } finally {
      setIsAutomating(false);
      setLoading(false);
    }
  };

  const formatError = (err: any) => {
     let message = '';
     if (typeof err === 'string') message = err;
     else if (err?.message) {
         try {
             if (err.message.trim().startsWith('{')) {
                const parsed = JSON.parse(err.message);
                if (parsed.error && parsed.error.message) message = parsed.error.message;
                else message = err.message;
             } else {
                message = err.message;
             }
         } catch { message = err.message; }
     } else {
         message = JSON.stringify(err);
     }

     if (message.includes("Requested entity was not found")) {
        setAppState(AppState.KEY_SELECTION);
     }
     return message;
  };

  const checkKey = useCallback(async () => {
    try {
      const aistudio = getAiStudio();
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) setAppState(AppState.KEY_SELECTION);
      }
    } catch (e) { console.error("Key check error", e); }
  }, []);

  useEffect(() => { checkKey(); }, [checkKey]);

  const handleOpenKeySelector = async () => {
    const aistudio = getAiStudio();
    if (aistudio) {
      await aistudio.openSelectKey();
      setAppState(AppState.START);
      addLog('AUTH_CREDENTIALS_UPDATED: SYSTEM_READY');
    }
  };

  const startFullAutonomy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || isAutomating) return;
    
    setIsAutomating(true);
    setLoading(true);
    addLog(`INITIALIZING_FULL_AUTONOMY: ${topic.toUpperCase()} [${selectedScriptModel}]`);

    try {
      const scriptJson = await GeminiService.generateScript(topic, selectedScriptModel);
      const parsed: ScriptData = JSON.parse(scriptJson);
      setScript(parsed);
      setAppState(AppState.EDITOR);
      addLog('SCRIPT_COMPILED: SYSTEM_READY_FOR_DEPLOYMENT');
    } catch (err: any) {
      addLog(`CRITICAL_FAILURE: ${formatError(err)}`);
    } finally {
      setIsAutomating(false);
      setLoading(false);
    }
  };

  const handleUpdateSegment = (id: string, updates: Partial<ScriptSegment>) => {
    if (!script) return;
    setScript(prev => {
        if (!prev) return null;
        return {
            ...prev,
            segments: prev.segments.map(s => s.id === id ? { ...s, ...updates } : s)
        };
    });
  };

  // Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingSegmentId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        handleUpdateSegment(uploadingSegmentId, { thumbnailUrl: result });
        addLog(`IMG_UPLOAD: Source asset loaded for ${uploadingSegmentId}`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
    setUploadingSegmentId(null);
  };

  const triggerFileUpload = (segId: string) => {
    setUploadingSegmentId(segId);
    fileInputRef.current?.click();
  };

  const handleGenerateKeyframe = async (segment: ScriptSegment) => {
    if (generatingKeyframeId) return;
    setGeneratingKeyframeId(segment.id);
    addLog(`INIT_KEYFRAME: Generating Banana Reference for ${segment.id}`);
    try {
      // Uses Gemini 2.5 Flash Image (Nano Banana)
      const base64 = await GeminiService.generateThumbnail(segment.visualPrompt, segment.id);
      const dataUrl = `data:image/png;base64,${base64}`;
      if (script) {
        const updated = script.segments.map(s => 
          s.id === segment.id ? { ...s, thumbnailUrl: dataUrl } : s
        );
        setScript({ ...script, segments: updated });
      }
      setVideoUrl(dataUrl);
      addLog(`KEYFRAME_READY: Reference locked for ${segment.id}`);
      return dataUrl;
    } catch (err: any) {
      addLog(`ERR_KEYFRAME: ${formatError(err)}`);
      throw err;
    } finally {
      setGeneratingKeyframeId(null);
    }
  };

  const handleGenerateVideo = async (segment: ScriptSegment, customThumb?: string) => {
    if (generatingVideoId) return;
    setGeneratingVideoId(segment.id);
    addLog(`RENDER_VEO: Initiating ${selectedVeoModel} for segment ${segment.id}`);
    
    try {
      let imageParam = undefined;
      const thumb = customThumb || segment.thumbnailUrl;
      if (thumb) {
        // Dynamic Mime Type detection
        const match = thumb.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = match ? match[1] : 'image/png';

        imageParam = {
          imageBytes: thumb.split(',')[1],
          mimeType: mimeType
        };
      }

      // We rely on GeminiService to append the global brand/motion tokens.
      // Passing the segment prompt directly prevents duplication.
      const url = await GeminiService.generateVideo(
        segment.visualPrompt, 
        segment.id,
        selectedResolution, 
        selectedAspectRatio, 
        selectedFps,
        imageParam,
        selectedVeoModel
      );
      
      if (script) {
        const updatedSegments = script.segments.map(s => 
          s.id === segment.id ? { ...s, videoUrl: url } : s
        );
        setScript({ ...script, segments: updatedSegments });
      }
      setVideoUrl(url);
      addLog(`RENDER_SUCCESS: Module ${segment.id} linked.`);
    } catch (err: any) {
      addLog(`ERR_RENDER: ${formatError(err)}`);
      throw err;
    } finally {
      setGeneratingVideoId(null);
    }
  };

  const handleToggleAudio = async (segment: ScriptSegment) => {
    if (currentlyPlayingId === segment.id) { stopAudio(); return; }
    setGeneratingAudioId(segment.id);
    try {
      const base64Audio = await GeminiService.generateSpeech(segment.voicemail, segment.id);
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
      setSynthesizedBuffers(prev => ({ ...prev, [segment.id]: buffer }));
      if (!autoSequencingId) playBuffer(segment.id, buffer);
      return buffer;
    } catch (err: any) {
      addLog(`ERR_VOICE: ${formatError(err)}`);
      throw err;
    } finally {
      setGeneratingAudioId(null);
    }
  };

  const startAutoSequence = async (segment: ScriptSegment): Promise<boolean> => {
    if (autoSequencingId) return false;
    setAutoSequencingId(segment.id);
    
    try {
      setPipelineStep('VOICE');
      addLog(`AUTO_PIPE [${segment.id}]: Step 1/3 -> SYNT_VOICE`);
      await handleToggleAudio(segment);
      
      setPipelineStep('KEYFRAME');
      addLog(`AUTO_PIPE [${segment.id}]: Step 2/3 -> GEN_KEYFRAME (BANANA)`);
      const thumb = await handleGenerateKeyframe(segment);
      
      setPipelineStep('VIDEO');
      addLog(`AUTO_PIPE [${segment.id}]: Step 3/3 -> REND_VEO`);
      await handleGenerateVideo(segment, thumb);
      
      addLog(`AUTO_PIPE_SUCCESS [${segment.id}]: FULLY_SYNTHESIZED`);
      return true;
    } catch (err) {
      addLog(`AUTO_PIPE_FAILURE [${segment.id}]: Sequence aborted.`);
      return false;
    } finally {
      setAutoSequencingId(null);
      setPipelineStep(null);
    }
  };

  const runMasterSequence = async () => {
    if (!script || isMasterSequencing) return;
    setIsMasterSequencing(true);
    abortMasterSequence.current = false;
    addLog("MASTER_PIPE: Initiating serial sequence for all segments...");
    
    for (const segment of script.segments) {
      if (abortMasterSequence.current) {
        addLog("MASTER_PIPE: Sequence manually aborted by operator.");
        break;
      }
      
      if (segment.videoUrl) continue; // Skip already rendered
      
      setActiveTimelineSegmentId(segment.id);
      segmentRefs.current[segment.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const success = await startAutoSequence(segment);
      if (!success) {
         addLog(`MASTER_PIPE_WARN: Segment ${segment.id} failed. Pausing for 5s before next...`);
         await new Promise(r => setTimeout(r, 5000));
      } else {
         await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    setIsMasterSequencing(false);
    addLog("MASTER_PIPE_COMPLETE: Operation finished.");
  };

  const handleStopMasterSequence = () => {
    if (isMasterSequencing) {
        abortMasterSequence.current = true;
        addLog("MASTER_PIPE: Abort signal received. Stopping after current task...");
    }
  };

  const stopAudio = () => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    setCurrentlyPlayingId(null);
  };

  const playBuffer = (id: string, buffer: AudioBuffer) => {
    stopAudio();
    const ctx = audioContextRef.current!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setCurrentlyPlayingId(null);
    source.start();
    currentSourceRef.current = source;
    setCurrentlyPlayingId(id);
  };

  if (appState === AppState.KEY_SELECTION) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="max-w-xl w-full text-center space-y-8">
          <h1 className="text-6xl font-bold glitch-text text-red-600 font-header" data-text="AUTH_LOCKED">AUTH_LOCKED</h1>
          <button onClick={handleOpenKeySelector} className="w-full bg-red-600 hover:bg-white hover:text-red-900 text-white font-bold py-4 px-8 uppercase tracking-widest shadow-[0_0_30px_rgba(255,0,0,0.4)] transition-all font-header">Unlock Studio Access</button>
          <div className="text-gray-500 text-[10px] uppercase tracking-tighter mt-4 font-mono">
            Note: You must select an API key from a paid GCP project. 
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-red-500 underline ml-1">Billing Documentation</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-mono selection:bg-red-600 selection:text-white">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-black sticky top-0 z-[60]">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 bg-red-600 animate-pulse rounded-none shadow-[0_0_15px_red]"></div>
          <span className="font-header font-bold text-xl tracking-[0.2em] glitch-text uppercase text-white" data-text="PierringShot AI">PierringShot AI</span>
        </div>
        <div className="flex gap-2">
          {Object.entries(retryingIds).map(([id, time]) => (
            <div key={id} className="text-[12px] bg-red-900/50 text-white border border-red-500 px-2 py-1 animate-pulse font-pixel">
              {id.toUpperCase()} RETRY: {Math.max(0, Math.ceil(((time as number) - Date.now())/1000))}s
            </div>
          ))}
          <button onClick={() => setViewMode(ViewMode.STUDIO)} className={`px-4 py-1 text-lg font-pixel uppercase transition-all ${viewMode === ViewMode.STUDIO ? 'bg-white text-black' : 'border border-white/20 text-gray-400 hover:text-white'}`}>Studio</button>
          <button onClick={() => setViewMode(ViewMode.CODEX)} className={`px-4 py-1 text-lg font-pixel uppercase transition-all ${viewMode === ViewMode.CODEX ? 'bg-blue-600 text-white' : 'border border-white/20 text-gray-400 hover:text-white'}`}>Codex</button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
        {/* Left Panel */}
        <div className="w-full md:w-[400px] flex flex-col gap-4">
          <div className="bg-[#050505] border border-white/10 p-6">
            <h2 className="text-xl font-pixel text-white uppercase mb-4 tracking-widest border-b border-white/10 pb-2">MISSION_PARAMS</h2>
            <form onSubmit={startFullAutonomy} className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase mb-1 block tracking-wider">Operation Topic</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ENTER_TOPIC..." className="w-full bg-black border border-white/20 p-3 text-white focus:outline-none focus:border-red-600 font-mono text-sm placeholder:text-gray-700 uppercase" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase mb-1 block tracking-wider">System Resources</label>
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSelectedScriptModel('gemini-3-flash-preview')} className={`py-1 text-sm font-pixel border uppercase tracking-wider ${selectedScriptModel === 'gemini-3-flash-preview' ? 'bg-white text-black' : 'border-white/20 text-gray-500 hover:text-white'}`}>FLASH</button>
                    <button type="button" onClick={() => setSelectedScriptModel('gemini-3-pro-preview')} className={`py-1 text-sm font-pixel border uppercase tracking-wider ${selectedScriptModel === 'gemini-3-pro-preview' ? 'bg-blue-600 text-white border-blue-600' : 'border-white/20 text-gray-500 hover:text-white'}`}>PRO</button>
                    <button type="button" onClick={() => setSelectedVeoModel('veo-3.1-fast-generate-preview')} className={`py-1 text-sm font-pixel border uppercase tracking-wider ${selectedVeoModel.includes('fast') ? 'bg-white text-black' : 'border-white/20 text-gray-500 hover:text-white'}`}>VEO_FAST</button>
                    <button type="button" onClick={() => setSelectedVeoModel('veo-3.1-generate-preview')} className={`py-1 text-sm font-pixel border uppercase tracking-wider ${!selectedVeoModel.includes('fast') ? 'bg-blue-600 text-white border-blue-600' : 'border-white/20 text-gray-500 hover:text-white'}`}>VEO_PRO</button>
                </div>
              </div>

              <button disabled={loading || isAutomating} className="w-full py-3 bg-red-600 hover:bg-white hover:text-black text-white font-bold uppercase text-lg font-header tracking-widest disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(255,0,0,0.3)]">COMPILE_MISSION</button>
            </form>
          </div>
          <VideoPreview url={videoUrl} onClose={() => setVideoUrl(null)} />
          <div className="flex-1 min-h-[200px]"><Terminal logs={logs} /></div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 bg-[#050505] border border-white/10 flex flex-col overflow-hidden relative">
          
          {viewMode === ViewMode.CODEX ? (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-black custom-scrollbar">
              <div className="flex justify-between items-center mb-6 border-b border-blue-900/30 pb-4">
                <h3 className="text-2xl font-header text-blue-500 uppercase tracking-widest">Global_Threat_Codex</h3>
                {scanningTopics && <div className="text-blue-500 font-pixel animate-pulse">SCANNING_NETWORKS...</div>}
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {trendingTopics.length > 0 ? trendingTopics.map((t, idx) => (
                   <div key={idx} className="border border-blue-900/50 bg-blue-900/5 p-4 group hover:border-blue-500 transition-all hover:bg-blue-900/10">
                     <div className="flex justify-between items-start mb-2">
                       <h4 className="text-lg font-header text-white group-hover:text-blue-400 uppercase">{t.title}</h4>
                       <span className="text-[10px] font-mono text-blue-500 border border-blue-900 px-2 py-0.5">HIGH_PRIORITY</span>
                     </div>
                     <p className="text-xs text-gray-400 mb-2 font-mono">{t.description}</p>
                     <div className="flex items-center gap-2 mb-4">
                       <span className="text-[10px] text-gray-600 uppercase tracking-wider">RELEVANCE:</span>
                       <span className="text-xs text-blue-300 font-mono">{t.relevance}</span>
                     </div>
                     <button 
                       onClick={() => handleDeployTopic(t)}
                       className="w-full py-2 bg-blue-600 hover:bg-white hover:text-blue-900 text-white font-bold font-header uppercase tracking-widest text-xs transition-colors"
                     >
                       DEPLOY_COUNTERMEASURE
                     </button>
                   </div>
                )) : (
                  !scanningTopics && (
                    <div className="text-center py-12 text-gray-600 font-pixel">
                      NO SIGNALS INTERCEPTED. CHECK CONNECTION OR RETRY SCAN.
                      <br/>
                      <button onClick={scanForTopics} className="mt-4 border border-blue-900 px-4 py-2 text-blue-500 hover:text-white hover:border-blue-500">RETRY_SCAN</button>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            /* Studio View Logic */
            script ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4 border-b border-white/10 pb-4 flex justify-between items-end bg-black">
                <div className="flex-1">
                  <Timeline segments={script.segments} onSelectSegment={(id) => setActiveTimelineSegmentId(id)} activeSegmentId={activeTimelineSegmentId} />
                </div>
                <button 
                  onClick={isMasterSequencing ? handleStopMasterSequence : runMasterSequence} 
                  className={`ml-4 mb-4 px-6 py-2 border font-bold text-sm font-header uppercase tracking-widest transition-all ${isMasterSequencing ? 'bg-red-600 border-red-600 text-white hover:bg-white hover:text-red-600' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'}`}
                >
                  {isMasterSequencing ? 'ABORT_SEQUENCE' : 'Sequence_All_Segments'}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black">
                {script.segments.map(seg => (
                  <div 
                    key={seg.id} 
                    ref={(el) => { segmentRefs.current[seg.id] = el; }} 
                    className={`bg-[#0A0A0A] border p-4 group transition-all duration-300 ${activeTimelineSegmentId === seg.id ? 'border-red-600' : 'border-white/10 hover:border-white/30'}`}
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Visual Column */}
                      <div className="w-full md:w-48 shrink-0 space-y-2">
                        <div className="aspect-video bg-black border border-white/10 relative overflow-hidden flex items-center justify-center">
                          {seg.videoUrl ? (
                             <video 
                               src={seg.videoUrl} 
                               className="w-full h-full object-cover cursor-pointer" 
                               onClick={() => setVideoUrl(seg.videoUrl)} 
                               autoPlay loop muted 
                             /> 
                          ) : (seg.thumbnailUrl ? (
                             <img 
                               src={seg.thumbnailUrl} 
                               className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all cursor-pointer" 
                               onClick={() => setVideoUrl(seg.thumbnailUrl)} 
                             /> 
                          ) : (
                             <div className="text-xl font-pixel text-white/20">NO_SIGNAL</div>
                          ))}
                          {(generatingVideoId === seg.id || generatingKeyframeId === seg.id || autoSequencingId === seg.id) && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
                            <div className="w-4 h-4 border border-t-red-500 rounded-full animate-spin"></div>
                            {autoSequencingId === seg.id && <span className="text-[10px] text-red-500 font-pixel animate-pulse">{pipelineStep}...</span>}
                          </div>}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1">
                          <button onClick={() => handleGenerateKeyframe(seg)} className={`py-1 text-[10px] font-pixel border uppercase transition-colors ${seg.thumbnailUrl ? 'bg-white text-black border-white' : 'border-white/20 text-gray-500 hover:text-white'}`}>Keyframe</button>
                          <button onClick={() => triggerFileUpload(seg.id)} className={`py-1 text-[10px] font-pixel border border-white/20 text-gray-500 hover:text-white uppercase transition-colors`}>Upload</button>
                          <button onClick={() => handleGenerateVideo(seg)} className={`py-1 text-[10px] font-pixel border uppercase transition-colors ${seg.videoUrl ? 'bg-red-600 text-white border-red-600' : 'border-white/20 text-gray-500 hover:text-red-500'}`}>Render_Veo</button>
                        </div>
                        
                        <button 
                          onClick={() => startAutoSequence(seg)} 
                          disabled={!!autoSequencingId} 
                          className={`w-full py-1 text-[10px] font-bold uppercase border transition-all ${autoSequencingId === seg.id ? 'bg-red-600 text-white animate-pulse' : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'}`}
                        >
                          {autoSequencingId === seg.id ? `Pipe: ${pipelineStep}` : 'Auto_Pipe'}
                        </button>
                      </div>

                      {/* Content Column */}
                      <div className="flex-1 space-y-3">
                         <div className="flex justify-between items-center border-b border-white/10 pb-2">
                           <div className="flex items-center gap-3">
                             <h4 className="text-sm font-header font-bold text-white uppercase tracking-widest">{seg.title}</h4>
                             <span className="text-[10px] text-gray-500 font-mono">{seg.timeRange}</span>
                           </div>
                           <button onClick={() => handleToggleAudio(seg)} className={`px-3 py-1 text-[10px] font-bold border transition-colors ${currentlyPlayingId === seg.id ? 'bg-green-500 text-black border-green-500' : 'border-green-900 text-green-500 hover:bg-green-500 hover:text-black'}`}>
                             {generatingAudioId === seg.id ? 'SYNT...' : (currentlyPlayingId === seg.id ? 'STOP' : 'PLAY_TTS')}
                           </button>
                         </div>
                         
                         <div className="space-y-2">
                            <div className="relative group/prompt">
                                <div className="flex justify-between items-center mb-1 absolute left-0 top-0 w-full bg-black/80 px-1 z-10 border-b border-white/10">
                                  <span className="text-[8px] text-red-500 font-bold uppercase tracking-widest">VISUAL_PROMPT</span>
                                  <div>
                                    <button 
                                      onClick={() => handleUpdateSegment(seg.id, { 
                                        visualPrompt: seg.visualPrompt.trim() 
                                          ? `${seg.visualPrompt.trim()}, Heavy datamoshing transition, pixel sorting, RGB split distortion, screen tearing effect, digital noise` 
                                          : 'Heavy datamoshing transition, pixel sorting, RGB split distortion, screen tearing effect, digital noise'
                                      })}
                                      className="text-[8px] bg-red-900/30 text-red-500 border border-red-900/50 px-2 hover:bg-red-600 hover:text-white transition-colors uppercase"
                                    >
                                      + GLITCH_FX
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateSegment(seg.id, { 
                                        visualPrompt: seg.visualPrompt.trim() 
                                          ? `${seg.visualPrompt.trim()}, Silhouette of a hacker in a hoodie, face obscured by shadow, backlit by screens, cinematic lighting` 
                                          : 'Silhouette of a hacker in a hoodie, face obscured by shadow, backlit by screens, cinematic lighting'
                                      })}
                                      className="text-[8px] bg-blue-900/30 text-blue-500 border border-blue-900/50 px-2 hover:bg-blue-600 hover:text-white transition-colors uppercase ml-2"
                                    >
                                      + PHANTOM
                                    </button>
                                  </div>
                                </div>
                                <textarea 
                                    value={seg.visualPrompt}
                                    onChange={(e) => handleUpdateSegment(seg.id, { visualPrompt: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 text-[10px] text-gray-300 p-2 pt-6 min-h-[60px] focus:outline-none focus:border-red-600 font-mono resize-y pl-2 block"
                                />
                                <AssetLibrary onSelect={(asset) => handleUpdateSegment(seg.id, { 
                                  visualPrompt: seg.visualPrompt.trim() 
                                    ? `${seg.visualPrompt.trim()}, ${asset.prompt}` 
                                    : asset.prompt 
                                })} />
                            </div>
                            <div className="relative mt-2">
                                <span className="absolute left-0 top-0 text-[8px] text-blue-500 font-bold uppercase tracking-widest">NARRATIVE</span>
                                <div className="text-[11px] text-white/90 leading-relaxed font-mono bg-white/5 p-3 border-l-2 border-blue-500 pl-3 ml-24">{seg.voicemail}</div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-30">
              <div className="w-24 h-24 border border-white rounded-full flex items-center justify-center mb-6">
                <div className="w-20 h-20 border border-white/50 rounded-full animate-ping"></div>
              </div>
              <h3 className="text-2xl font-header text-white uppercase tracking-widest animate-pulse">System_Standby</h3>
              <p className="text-xs text-gray-500 mt-4 font-pixel tracking-[0.5em]">AWAITING_INPUT_VECTOR</p>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
        @keyframes scan { from { top: -100%; } to { top: 100%; } }
      `}</style>
    </div>
  );
};

export default App;