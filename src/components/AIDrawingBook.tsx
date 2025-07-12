import React from "react";
import {
  Palette,
  Sparkles,
  RotateCcw,
  BookOpen,
  Wand2,
  Camera,
  Loader,
  Lightbulb,
  Play,
  Volume2,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Zap,
  Download,
} from "lucide-react";
import { GeminiService } from "../services/GeminiService";
import { useAIDrawingBookLogic } from "../hooks/useAIDrawingBookLogic";
import ColorPalette from "./ColorPalette";
import HistoryThumbnails from "./HistoryThumbnails";
import WebcamModal from "./WebcamModal";
import MagicWandAnimation from "./MagicWandAnimation";
import "../index.css";

interface AIDrawingBookProps {
  onBack: () => void;
}

const AIDrawingBook: React.FC<AIDrawingBookProps> = ({ onBack }) => {
  const {
    // Refs
    sketchCanvasRef,
    coloringCanvasRef,
    webcamVideoRef,
    
    // State
    selectedColor,
    hasGeneratedContent,
    currentPrompt,
    story,
    recognizedImage,
    isGenerating,
    isGettingIdea,
    isGeneratingStory,
    isTypingStory,
    displayedStory,
    showStorySection,
    error,
    isReadingStory,
    storyImageBase64,
    showStoryImage,
    history,
    selectedHistoryIndex,
    showWebcam,
    colors,
    
    // Video generation
    generatedAudioBlob,
    isGeneratingVideo,
    ffmpegLoaded,
    ffmpegLoading,
    generateAndDownloadVideo,
    
    // Pen tool state
    togglePenMode,
    isPenMode,
    brushSize,
    setBrushSize,
    
    // Drawing handlers
    startDrawing,
    drawSketch,
    stopDrawing,
    handleColoringClick,
    handleColorSelect,
    
    // Action handlers
    handleClearAll,
    getDrawingIdea,
    enhanceDrawing,
    generateStory,
    handleReadStory,
    
    // History handlers
    handleSelectHistory,
    handleDeleteHistory,
    
    // Webcam handlers
    setShowWebcam,
    handleWebcamCapture,
    handleWebcamCancel,
    
    // Pen tool handlers
    handleColoringMouseMove,
    handleColoringMouseUp,
  } = useAIDrawingBookLogic();

  // API Key Check UI
  if (!GeminiService.getApiKey()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center border border-purple-100">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            AI Magic Needs Setup
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            To unlock the full AI drawing experience, please configure your Gemini API key in the environment variables.
          </p>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 font-semibold shadow-lg"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex flex-col">
      {/* Compact Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 border border-purple-100"
            >
              <ArrowLeft size={18} className="text-purple-600" />
              <span className="text-purple-600 font-semibold hidden sm:inline text-sm">Back</span>
            </button>
            
            <div className="text-center flex-1 mx-4">
              <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600">
                ✨ AI Art Studio
              </h1>
            </div>

            <div className="w-16 sm:w-24"></div>
          </div>
        </div>
      </header>

      {/* Main Content Container with margin below*/}
      <div className="flex-1 flex flex-col p-2 sm:p-2 gap-2 max-w-full px-4 sm:px-6 lg:px-8">
        
        {/* Top Row: Gallery (Horizontal on tablets/phones) */}
        <div className="flex flex-col lg:flex-row gap-3"> 
          
          {/* Gallery Section - Horizontal scroll on mobile/tablet*/}
          <div className="bg-white rounded-xl shadow-lg p-3 border border-purple-200 lg:flex-1"> 
            <h3 className="text-lg font-bold text-purple-700 mb-2 text-center lg:text-left">Gallery</h3>
            <div className="flex lg:flex-row gap-2 overflow-x-auto lg:overflow-x-auto lg:overflow-y-hidden lg:h-24">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center text-sm whitespace-nowrap lg:whitespace-normal">No drawings</p>
              ) : (
                history.map((item, index) => (
                  <div
                    key={index}
                    className={`relative flex-shrink-0 w-16 h-16 lg:w-24 lg:h-24 border-2 rounded-lg cursor-pointer overflow-hidden transform transition-all duration-200 ease-in-out
                      ${selectedHistoryIndex === index ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'}`}
                    onClick={() => handleSelectHistory(index)}
                  >
                    <img
                      src={`data:image/png;base64,${item.generated}`}
                      alt={`Drawing ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => handleDeleteHistory(index, e)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600 transition-all duration-200"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-1 left-1 w-5 h-5 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-white font-bold text-xs shadow-lg">
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* AI Prompt Display */}
        {currentPrompt && (
          <div className="animate__animated animate__fadeIn">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-3 shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb size={16} className="text-yellow-300" />
                <span className="font-bold text-sm">Drawing Inspiration:</span>
              </div>
              <p className="text-sm leading-relaxed">{currentPrompt}</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="animate__animated animate__fadeIn">
            <div className="bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-3 shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-sm">⚠️</span>
                <span className="font-semibold text-sm">Error:</span>
              </div>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Story Section */}
        {showStorySection && (
          <section className="animate__animated animate__fadeInUp">
            <div className="bg-white rounded-xl shadow-lg border border-orange-200 overflow-hidden">
              {/* line them side by side */}
              <div className="flex items-center justify-center bg-gradient-to-r from-orange-400 to-pink-500 p-2">
                <BookOpen size={18} className="text-white font-bold text-lg mr-1" />
                <h4 className="text-white font-bold text-lg">
                  Your Story
                </h4>
                
                <div className="flex flex-wrap gap-2 items-center mb-3">
                  <button
                    onClick={generateStory}
                    disabled={isGeneratingStory || isTypingStory}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                  >
                    {isGeneratingStory || isTypingStory ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        {isGeneratingStory ? 'Creating...' : 'Writing...'}
                      </>
                    ) : (
                      <>
                        <Zap size={16} />
                        Create Story
                      </>
                    )}
                  </button>

                  {!isTypingStory && story && (
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm"
                      onClick={() => handleReadStory('pollinations')}
                      disabled={isReadingStory}
                    >
                      {isReadingStory ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Reading...
                        </>
                      ) : (
                        <>
                          <Volume2 size={16} />
                          Read Aloud
                        </>
                      )}
                    </button>
                  )}

                  {!isTypingStory && story && generatedAudioBlob && (
                    <button
                      onClick={generateAndDownloadVideo}
                      disabled={isGeneratingVideo || selectedHistoryIndex === null || ffmpegLoading || !ffmpegLoaded}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                    >
                      {ffmpegLoading ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Loading...
                        </>
                      ) : isGeneratingVideo ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Video
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
              
              <div className="p-1">
                
                {/* Story Display */}
                {(story || displayedStory) && (
                  <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-1 border border-orange-200">
                    <div className="text-sm leading-relaxed text-gray-800">
                      {isTypingStory ? (
                        <span>
                          {displayedStory}
                          <span className="animate-pulse text-orange-500">|</span>
                        </span>
                      ) : (
                        story
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Canvas Section - Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 w-full gap-3">

          {/* Drawing Canvas */}
          <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden flex-1">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Palette size={20} />
                  Draw Here
                </h3>
                <button
                  onClick={() => setShowWebcam(true)}
                  disabled={showWebcam}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Camera size={16} />
                  <span className="hidden sm:inline">Photo</span>
                </button>
              </div>
            </div>
            
            <div className="p-1">
              <div className="relative aspect-square bg-gray-50 rounded-xl border-4 border-dashed border-purple-300 overflow-hidden">
                <canvas
                  ref={sketchCanvasRef}
                  className={`w-full h-full rounded-xl cursor-crosshair transition-opacity duration-300 ${
                    showWebcam ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                  onMouseDown={startDrawing}
                  onMouseMove={drawSketch}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={drawSketch}
                  onTouchEnd={stopDrawing}
                />
                
                {showWebcam && (
                  <WebcamModal
                    showWebcam={showWebcam}
                    webcamVideoRef={webcamVideoRef}
                    onCapture={handleWebcamCapture}
                    onCancel={handleWebcamCancel}
                  />
                )}

                {!showWebcam && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-purple-400">
                      <Palette size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium">Start drawing!</p>
                    </div>
                  </div>
                )}
              </div>

              {recognizedImage && (
                <div className="mt-2 animate__animated animate__fadeIn">
                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-300 text-purple-800 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Wand2 size={16} className="text-purple-600" />
                      <span className="font-bold text-sm">AI Vision:</span>
                    </div>
                    <p className="text-sm">{recognizedImage}</p>
                  </div>
                </div>
              )}
            </div>
            
          </div>

          {/* AI Generated Canvas with Color Palette */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* AI Generated Canvas */}
            <div className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden flex-1">
              <div className="bg-gradient-to-r from-green-500 to-blue-500">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Wand2 size={20} />
                  AI Magic Canvas
                </h3>
              </div>
              
              <div className="p-1">
                <div className="relative aspect-square bg-gray-50 rounded-xl border-4 border-dashed border-green-300 overflow-hidden">
                  <MagicWandAnimation isVisible={isGenerating} />

                  {storyImageBase64 && (
                    <div
                      className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 z-20"
                      style={{ opacity: showStoryImage ? 1 : 0 }}
                    >
                      <img
                        src={`data:image/png;base64,${storyImageBase64}`}
                        alt="Story Illustration"
                        className={`w-full h-full object-contain rounded-xl ${showStoryImage ? "slow-fade-animation" : ""}`}
                      />
                    </div>
                  )}

                  <canvas
                    ref={coloringCanvasRef}
                    className={`w-full h-full rounded-xl transition-opacity duration-1000 ${
                      hasGeneratedContent ? "block cursor-crosshair" : "hidden"
                    }`}
                    style={{
                      opacity: showStoryImage ? 0 : 1,
                      zIndex: 10,
                      position: "relative",
                    }}
                    onMouseDown={handleColoringClick}
                    onMouseMove={handleColoringMouseMove}
                    onMouseUp={handleColoringMouseUp}
                    onMouseLeave={handleColoringMouseUp}
                    onTouchStart={handleColoringClick}
                    onTouchMove={handleColoringMouseMove}
                    onTouchEnd={handleColoringMouseUp}
                  />

                  {hasGeneratedContent && (
                    <div className="absolute bottom-2 right-2 z-30">
                      <div
                        className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-colors duration-200"
                        style={{ backgroundColor: selectedColor }}
                        title={`Current color: ${selectedColor}`}
                      />
                    </div>
                  )}

                  {!isGenerating && !hasGeneratedContent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-green-400">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-medium">AI artwork appears here!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Color Palette - Vertical beside AI Canvas */}
            <div className="bg-white rounded-xl shadow-lg p-3 border border-orange-200 lg:w-24">
              <h3 className="text-lg font-bold text-orange-700 mb-2 text-center lg:text-center">Tools</h3>
              
              {/* Pen Tool Toggle */}
              <div className="mb-3 flex justify-center">
                <button
                  onClick={togglePenMode}
                  disabled={!hasGeneratedContent}
                  className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPenMode 
                      ? 'bg-purple-500 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={isPenMode ? 'Switch to Fill Tool' : 'Switch to Pen Tool'}
                >
                  {isPenMode ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v11H4V4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Brush Size Slider (only show in pen mode) */}
              {isPenMode && hasGeneratedContent && (
                <div className="mb-3">
                  <label className="text-xs text-gray-600 block text-center mb-1">Size</label>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-center text-gray-500 mt-1">{brushSize}px</div>
                </div>
              )}
              
              <div className="flex flex-row lg:flex-col flex-wrap gap-2 justify-center lg:justify-start">
                {colors.map((color, index) => (
                  <button
                    key={index}
                    onClick={(e) => handleColorSelect(color, e)}
                    disabled={!hasGeneratedContent}
                    className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full border-2 transition-all duration-200 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedColor === color ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Color: ${color}`}
                  />
                ))}
              </div>
              
              {/* Mode Indicator */}
              <div className="mt-3 text-center">
                <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isPenMode 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {isPenMode ? '✏️ Pen' : '🎨 Fill'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Responsive layout */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <button
            onClick={getDrawingIdea}
            disabled={isGettingIdea}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
          >
            {isGettingIdea ? (
              <>
                <Loader size={20} className="animate-spin" />
                <span className="hidden sm:inline">Thinking...</span>
              </>
            ) : (
              <>
                <Lightbulb size={20} />
                <span>Get Idea</span>
              </>
            )}
          </button>

          <button
            onClick={enhanceDrawing}
            disabled={isGenerating || history.length >= 10 || showWebcam}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
            title={
              history.length >= 10
                ? "Maximum of 10 drawings reached. Delete a thumbnail to create more."
                : showWebcam
                ? "Close camera first"
                : undefined
            }
          >
            {isGenerating ? (
              <>
                <Loader size={20} className="animate-spin" />
                <span className="hidden sm:inline">Creating...</span>
              </>
            ) : (
              <>
                <Wand2 size={20} />
                <span>AI Magic</span>
              </>
            )}
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-sm"
          >
            <RotateCcw size={20} />
            <span>Clear All</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIDrawingBook;