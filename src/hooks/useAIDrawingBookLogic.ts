import { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GeminiService } from '../services/GeminiService';
import { PollinationsService } from '../services/PollinationsService';
import { resizeBase64Image, blobToBase64, getCanvasPos, hexToRgbA, getPixelColor, setPixelColor, colorsMatch } from '../utils/imageUtils';

// Declare FFmpeg types for the older version
declare global {
  interface Window {
    FFmpeg: {
      createFFmpeg: (options?: any) => any;
      fetchFile: (data: any) => Promise<Uint8Array>;
    };
  }
}

interface HistoryItem {
  sketch: string;
  generated: string; // This will now store the potentially colored image
  recognizedImage: string;
  prompt: string;
  story: string;
  storyImageBase64?: string;
} 

export const useAIDrawingBookLogic = () => {
  // Canvas refs
  const sketchCanvasRef = useRef<HTMLCanvasElement>(null);
  const coloringCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState<string>("#FF0000");
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  
  // Pen tool state
  const [isPenMode, setIsPenMode] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [isDrawingOnColoring, setIsDrawingOnColoring] = useState(false);
  const [lastColoringPos, setLastColoringPos] = useState({ x: 0, y: 0 });

  // UI and AI state
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [story, setStory] = useState<string>("");
  const [recognizedImage, setRecognizedImage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGettingIdea, setIsGettingIdea] = useState(false);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [showStorySection, setShowStorySection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadingStory, setIsReadingStory] = useState(false);
  const [isTypingStory, setIsTypingStory] = useState(false);
  const [displayedStory, setDisplayedStory] = useState<string>("");

  // Story image overlay state
  const [storyImageBase64, setStoryImageBase64] = useState<string | null>(null);
  const [showStoryImage, setShowStoryImage] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);

  // Webcam state - Fixed: Better state management
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isWebcamReady, setIsWebcamReady] = useState(false);

  // Video generation state
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);

  // Color palette
  const colors = [
    "#FF0000", "#0000FF", "#00FF00", "#FFFF00", "#FF7F00",
    "#BF00BF", "#00FFFF", "#FFC0CB", "#8B4513", "#808080", "#FFFFFF"
  ];

  const ffmpegRef = useRef<any>(null);

  // Confetti celebration function
  const celebrateWithConfetti = () => {
    // Multiple confetti bursts for extra celebration
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    });
    
    // Second burst with different timing
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#ffd700', '#ff69b4', '#98fb98', '#87ceeb']
      });
    }, 300);
    
    // Third burst for grand finale
    setTimeout(() => {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#ff6347', '#40e0d0', '#ee82ee', '#90ee90']
      });
    }, 600);
  };

  // Play win sound function
  const playWinSound = () => {
    try {
      const winAudio = new Audio('/sounds/winSound.mp3');
      winAudio.volume = 0.5; // Set to 50% volume
      
      // Wait for audio to be ready before playing
      winAudio.oncanplaythrough = () => {
        winAudio.play().catch(e => {
          console.log('Win sound play failed:', e);
        });
      };
      
      winAudio.onerror = (e) => {
        console.log('Win sound loading failed:', e);
      };
      
      // If already loaded, play immediately
      if (winAudio.readyState >= 3) {
        winAudio.play().catch(e => {
          console.log('Win sound play failed:', e);
        });
      }
    } catch (error) {
      console.log('Error creating win sound:', error);
    }
  };

  // Background audio ref for better lifecycle management
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize FFmpeg
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded || ffmpegLoading) return;
    
    setFfmpegLoading(true);
    try {
      // Check if FFmpeg is available globally
      if (!window.FFmpeg) {
        throw new Error('FFmpeg library not loaded. Please refresh the page.');
      }

      const { createFFmpeg } = window.FFmpeg;
      const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.8.5/dist/ffmpeg-core.js',
      });
      
      ffmpegRef.current = ffmpeg;
      
      await ffmpeg.load();
      
      setFfmpegLoaded(true);
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      setError('Failed to initialize video processing. Please refresh the page and try again.');
    } finally {
      setFfmpegLoading(false);
    }
  }, [ffmpegLoaded, ffmpegLoading]);

  // Load FFmpeg on component mount
  useEffect(() => {
    loadFFmpeg().catch(console.error);
  }, [loadFFmpeg]);

  // Typing effect function
  const typeStory = useCallback((fullStory: string) => {
    setIsTypingStory(true);
    setDisplayedStory("");
    
    const words = fullStory.split(' ');
    let currentWordIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        setDisplayedStory(prev => {
          const newText = prev + (prev ? ' ' : '') + words[currentWordIndex];
          return newText;
        });
        currentWordIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTypingStory(false);
        
        // Play win sound and confetti when typing completes
        setTimeout(() => {
          playWinSound();
          celebrateWithConfetti();
        }, 500);
      }
    }, 150); // 150ms delay between words for smooth typing effect
    
    return () => clearInterval(typeInterval);
  }, []);

  // Canvas setup effects
  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = coloringCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // Fixed: Improved webcam stream management
  useEffect(() => {
    let mounted = true;

    if (showWebcam) {
      setIsWebcamReady(false);
      setError(null);
      
      navigator.mediaDevices
        .getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        })
        .then((stream) => {
          if (!mounted) {
            // Component unmounted, clean up stream
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          setWebcamStream(stream);
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = stream;
            webcamVideoRef.current.onloadedmetadata = () => {
              if (mounted) {
                setIsWebcamReady(true);
              }
            };
          }
        })
        .catch((err) => {
          if (mounted) {
            console.error('Webcam error:', err);
            setError("Could not access webcam. Please check permissions.");
            setShowWebcam(false);
          }
        });
    } else {
      // Clean up webcam when hiding
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
        setWebcamStream(null);
      }
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = null;
      }
      setIsWebcamReady(false);
    }

    return () => {
      mounted = false;
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showWebcam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [webcamStream]);

  // Canvas utility functions
  const resizeColoringCanvas = () => {
    const canvas = coloringCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };

  const isSketchCanvasEmpty = useCallback((): boolean => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return true;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.every((pixel) => pixel === 0);
  }, []);

  const getSketchCanvasAsBase64 = useCallback((): string => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return "";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");

    if (tempCtx) {
      tempCtx.fillStyle = "#FFFFFF";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
    }

    return tempCanvas.toDataURL("image/png").split(",")[1];
  }, []);

  // Drawing handlers
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (showWebcam) return; // Prevent drawing when webcam is active
    
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const pos = getCanvasPos(canvas, e.nativeEvent);
    setLastPos(pos);
    canvas.style.cursor = "crosshair";
  };

  const drawSketch = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || !sketchCanvasRef.current || showWebcam) return;

    e.preventDefault();
    const canvas = sketchCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const currentPos = getCanvasPos(canvas, e.nativeEvent);

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    setLastPos(currentPos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (sketchCanvasRef.current) {
      sketchCanvasRef.current.style.cursor = "default";
    }
  };

  // Flood fill algorithm for coloring
  const floodFill = useCallback(
    (startX: number, startY: number, fillColor: string) => {
      const canvas = coloringCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const width = imageData.width;
      const height = imageData.height;

      const targetColor = getPixelColor(pixels, startX, startY, width);
      const replacementColor = hexToRgbA(fillColor);

      if (colorsMatch(targetColor, replacementColor)) {
        return;
      }

      const stack: [number, number][] = [[startX, startY]];
      let pixelCount = 0;

      while (stack.length > 0 && pixelCount < width * height * 4) {
        const [x, y] = stack.pop()!;

        if (x < 0 || x >= width || y < 0 || y >= height) {
          continue;
        }

        const currentColor = getPixelColor(pixels, x, y, width);

        if (colorsMatch(currentColor, targetColor)) {
          setPixelColor(pixels, x, y, width, replacementColor);
          pixelCount++;

          stack.push([x + 1, y]);
          stack.push([x - 1, y]);
          stack.push([x, y + 1]);
          stack.push([x, y - 1]);
        }
      }
      ctx.putImageData(imageData, 0, 0);
    },
    []
  );

  // Event handlers

  // Toggle pen mode function
  const togglePenMode = () => {
    setIsPenMode(prev => !prev);
  };

  // Handle mouse move for pen drawing
  const handleColoringMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingOnColoring || !isPenMode) return;
    
    const canvas = coloringCanvasRef.current;
    if (!canvas) return;
    
    e.preventDefault();
    const currentPos = getCanvasPos(canvas, e.nativeEvent);
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      
      // Create glossy effect with gradient
      const gradient = ctx.createRadialGradient(
        currentPos.x, currentPos.y, 0,
        currentPos.x, currentPos.y, brushSize / 2
      );
      gradient.addColorStop(0, selectedColor);
      gradient.addColorStop(0.7, selectedColor + '80');
      gradient.addColorStop(1, selectedColor + '20');
      
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(lastColoringPos.x, lastColoringPos.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      
      setLastColoringPos(currentPos);
    }
  };

  // Handle mouse up for pen drawing
  const handleColoringMouseUp = () => {
    setIsDrawingOnColoring(false);
    
    // Save the current state to history after drawing
    if (selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
      const canvas = coloringCanvasRef.current;
      if (canvas) {
        const updatedGeneratedBase64 = canvas.toDataURL("image/png").split(",")[1];
        setHistory((prev) =>
          prev.map((item, i) =>
            i === selectedHistoryIndex
              ? { ...item, generated: updatedGeneratedBase64 }
              : item
          )
        );
      }
    }
  };

  const handleColoringClick = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = coloringCanvasRef.current;
    if (!canvas || !hasGeneratedContent) {
      setError("Please generate a drawing first to color!");
      return;
    }
    setError(null);
    const { x, y } = getCanvasPos(canvas, e.nativeEvent);
    
    if (isPenMode) {
      // Start pen drawing
      setIsDrawingOnColoring(true);
      setLastColoringPos({ x, y });
      
      // Draw initial dot
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;
        
        // Create glossy effect with gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize / 2);
        gradient.addColorStop(0, selectedColor);
        gradient.addColorStop(0.7, selectedColor + '80'); // Semi-transparent
        gradient.addColorStop(1, selectedColor + '20'); // Very transparent
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Use flood fill
      floodFill(x, y, selectedColor);
    }

    // After coloring, save the current state of the coloring canvas to history
    if (selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
      const updatedGeneratedBase64 = canvas.toDataURL("image/png").split(",")[1];
      setHistory((prev) =>
        prev.map((item, i) =>
          i === selectedHistoryIndex
            ? { ...item, generated: updatedGeneratedBase64 }
            : item
        )
      );
    }
  };

  const handleColorSelect = (color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedColor(color);
  };

  const handleClearAll = useCallback(() => {
    const sketchCanvas = sketchCanvasRef.current;
    const coloringCanvas = coloringCanvasRef.current;
    if (sketchCanvas) {
      sketchCanvas
        .getContext("2d")
        ?.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    }
    if (coloringCanvas) {
      coloringCanvas
        .getContext("2d")
        ?.clearRect(0, 0, coloringCanvas.width, coloringCanvas.height);
    }
    setHasGeneratedContent(false);
    setCurrentPrompt("");
    setStory("");
    setRecognizedImage("");
    setShowStorySection(false);
    setError(null);
  }, []);

  // AI functions
  const getDrawingIdea = async () => {
    setIsGettingIdea(true);
    setError(null);

    try {
      const idea = await GeminiService.getDrawingIdea();
      setCurrentPrompt(idea);
    } catch (err: any) {
      console.error("Error getting idea:", err);
      setError(err.message || "Could not get an idea right now. Please try again!");
    } finally {
      setIsGettingIdea(false);
    }
  };

  const enhanceDrawing = async () => {
    if (showWebcam) {
      setError("Please close the camera first!");
      return;
    }

    if (isSketchCanvasEmpty()) {
      setError("Please draw something on the canvas first!");
      const errorSound = new Audio(
        "https://cdn.pixabay.com/download/audio/2023/05/15/audio_59378cd845.mp3?filename=a-nasty-sound-if-you-choose-the-wrong-one-149895.mp3"
      );
      errorSound.play();
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowStorySection(false);

    try {
      let base64ImageData = getSketchCanvasAsBase64();
      base64ImageData = await resizeBase64Image(base64ImageData, 200);

      // Check if this is a reused drawing
      let historyIdx = selectedHistoryIndex;
      let isReuse = false;
      if (
        historyIdx !== null &&
        history[historyIdx] &&
        history[historyIdx].sketch === base64ImageData
      ) {
        isReuse = true;
      }

      if (isReuse) {
        // Reuse: use previous prompt/description
        const sketchDescription = history[historyIdx!].recognizedImage;
        const imageGenerationPrompt = `${sketchDescription},coloring book style, line art, no fill, No sexual content , child friendly, black lines, white background`;
        const imageBlob = await PollinationsService.generateImage(imageGenerationPrompt);
        const imageUrl = URL.createObjectURL(imageBlob);

        const img = new window.Image();
        img.onload = async () => {
          setHasGeneratedContent(true);
          
          // Trigger confetti and win sound for successful generation
          celebrateWithConfetti();
          playWinSound();
          
          const coloringCanvas = coloringCanvasRef.current;
          if (!coloringCanvas) return;
          resizeColoringCanvas();
          const ctx = coloringCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, coloringCanvas.width, coloringCanvas.height);
            ctx.drawImage(img, 0, 0, coloringCanvas.width, coloringCanvas.height);
          }
          
          const generatedBase64 = await blobToBase64(imageBlob);
          setHistory((prev) => {
            const newHistory = [
              ...prev,
              {
                sketch: base64ImageData,
                generated: generatedBase64,
                recognizedImage: sketchDescription,
                prompt: currentPrompt,
                story: "",
              },
            ];
            // Set selectedHistoryIndex to the new item BEFORE drawing to canvas
            const newIndex = newHistory.length > 10 ? 9 : newHistory.length - 1;
            setSelectedHistoryIndex(newIndex);
            // Draw the generated image to coloring canvas immediately
            setTimeout(() => {
              const canvas = coloringCanvasRef.current;
              if (canvas) {
                resizeColoringCanvas();
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  const genImg = new window.Image();
                  genImg.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(genImg, 0, 0, canvas.width, canvas.height);
                  };
                  genImg.src = "data:image/png;base64," + generatedBase64;
                }
              }
            }, 0);
            return newHistory.length > 10
              ? newHistory.slice(newHistory.length - 10)
              : newHistory;
          });
          setShowStorySection(true);
          URL.revokeObjectURL(imageUrl);
        };
        img.onerror = () => {
          setError("Failed to load generated image for coloring.");
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      } else {
        // New drawing: call Gemini for description, then Pollinations
        const sketchDescription = await GeminiService.recognizeImage(base64ImageData);
        setRecognizedImage(sketchDescription);

        // Generate coloring book image
        const imageGenerationPrompt = `Simple black line art of ${sketchDescription}, kids' coloring book, no fill, white background.`;
        const imageBlob = await PollinationsService.generateImage(imageGenerationPrompt);
        const imageUrl = URL.createObjectURL(imageBlob);

        const img = new window.Image();
        img.onload = async () => {
          setHasGeneratedContent(true);
          
          // Trigger confetti and win sound for successful generation
          celebrateWithConfetti();
          playWinSound();
          
          const coloringCanvas = coloringCanvasRef.current;
          if (!coloringCanvas) return;
          resizeColoringCanvas();
          const ctx = coloringCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, coloringCanvas.width, coloringCanvas.height);
            ctx.drawImage(img, 0, 0, coloringCanvas.width, coloringCanvas.height);
          }
          
          const generatedBase64 = await blobToBase64(imageBlob);
          setHistory((prev) => {
            const newHistory = [
              ...prev,
              {
                sketch: base64ImageData,
                generated: generatedBase64,
                recognizedImage: sketchDescription,
                prompt: currentPrompt,
                story: "",
              },
            ];
            // Set selectedHistoryIndex to the new item BEFORE drawing to canvas
            const newIndex = newHistory.length > 10 ? 9 : newHistory.length - 1;
            setSelectedHistoryIndex(newIndex);
            // Draw the generated image to coloring canvas immediately
            setTimeout(() => {
              const canvas = coloringCanvasRef.current;
              if (canvas) {
                resizeColoringCanvas();
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  const genImg = new window.Image();
                  genImg.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(genImg, 0, 0, canvas.width, canvas.height);
                  };
                  genImg.src = "data:image/png;base64," + generatedBase64;
                }
              }
            }, 0);
            return newHistory.length > 10
              ? newHistory.slice(newHistory.length - 10)
              : newHistory;
          });
          setShowStorySection(true);
          URL.revokeObjectURL(imageUrl);
        };
        img.onerror = () => {
          setError("Failed to load generated image for coloring.");
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      }
    } catch (err: any) {
      console.error("Error generating image:", err);
      setError(err.message || "Oops! Something went wrong while creating the drawing.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateStory = async () => {
    // If selectedHistoryIndex is set and story exists in history, reuse it
    if (
      selectedHistoryIndex !== null &&
      history[selectedHistoryIndex] &&
      history[selectedHistoryIndex].story &&
      history[selectedHistoryIndex].story.trim() !== ""
    ) {
      setStory(history[selectedHistoryIndex].story);
      setStoryImageBase64(history[selectedHistoryIndex].storyImageBase64 || null);
      return;
    }

    if (!recognizedImage) {
      setError("Please generate a drawing first!");
      return;
    }

    setIsGeneratingStory(true);
    setError(null);

    try {
      const storyText = await GeminiService.generateStory(recognizedImage);
      setStory(storyText);
      
      // Start typing effect for the story
      typeStory(storyText);

      // Story image generation disabled due to CORS/network issues
      const storyImageBlob = await PollinationsService.generateImage("colorful child scene+no+nudit" + storyText);
      const storyImageBase64 = await blobToBase64(storyImageBlob); 
      setStoryImageBase64(storyImageBase64);
      // setStoryImageBase64(null);

      // Save story and story image to history if from history
      if (selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
        setHistory((prev) =>
          prev.map((item, idx) =>
            idx === selectedHistoryIndex
              ? { ...item, story: storyText, storyImageBase64: storyImageBase64 }
              : item
          )
        );
      }
    } catch (err: any) {
      console.error("Error generating story:", err);
      setError(err.message || "The storyteller seems to be napping! Please try again.");
      setStory("");
      setStoryImageBase64(null); 
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Enhanced cleanup function to ensure animation stops
  const cleanupStoryAnimation = useCallback(() => {
    console.log('🧹 Cleaning up story animation');
    
    // Clear the fade interval
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
      console.log('⏰ Cleared fade interval');
    }
    
    // Stop and cleanup background music
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
      bgAudioRef.current.currentTime = 0;
      bgAudioRef.current = null;
      console.log('🎵 Stopped background music');
    }
    
    // Reset animation state
    setShowStoryImage(false);
    setIsReadingStory(false);
    
    console.log('✅ Animation cleanup complete');
  }, []);

  // FIXED: Completely rewritten handleReadStory with proper cleanup
  const handleReadStory = async (storytellerType: 'pollinations' | 'elevenlabs' = 'pollinations') => {
    if (!story) return;
    
    console.log('🎬 Starting handleReadStory');
    console.log('🎭 Using storyteller:', storytellerType);
    console.log('📸 Current storyImageBase64:', !!storyImageBase64);
    console.log('🎨 hasGeneratedContent:', hasGeneratedContent);
    
    // STEP 1: Complete cleanup of any existing state
    cleanupStoryAnimation();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
      console.log('🔇 Stopped existing audio');
    }
    
    // STEP 2: Force reset animation state
    setShowStoryImage(false);
    setIsReadingStory(true);
    
    // STEP 3: Ensure we have the story image from current context
    let currentStoryImage = storyImageBase64;
    if (!currentStoryImage && selectedHistoryIndex !== null && history[selectedHistoryIndex]) {
      currentStoryImage = history[selectedHistoryIndex].storyImageBase64 || null;
      console.log('📚 Retrieved story image from history:', !!currentStoryImage);
      // Update the state to ensure consistency
      if (currentStoryImage) {
        setStoryImageBase64(currentStoryImage);
      }
    }
    
    console.log('🖼️ Final story image check:', !!currentStoryImage);
    
    try {
      let audioBlob: Blob;
      
      if (storytellerType === 'elevenlabs') {
        // Use ElevenLabs TTS
        const { ElevenLabsService } = await import('../services/ElevenLabsService');
        const storyText = `Tell a 4 year old kid a moral story about ${story}`;
        audioBlob = await ElevenLabsService.generateTTSAudio(storyText);
        console.log('🎤 Generated audio using ElevenLabs TTS');
      } else {
        // Use existing Pollinations AI
        const pollinationsApiKey = import.meta.env.VITE_POLLINATIONS_API_KEY;
        if (!pollinationsApiKey) {
          throw new Error('Pollinations AI API key not configured. Please add VITE_POLLINATIONS_API_KEY to your .env file.');
        }

        const encodedStory = encodeURIComponent(story);
        const voice = "alloy";
        // Add the API key as a query parameter using Bearer token method
        const url = `https://text.pollinations.ai/'tell a 4 year old kid a moral story about '${encodedStory}?model=openai-audio&voice=${voice}&token=${pollinationsApiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to generate audio from Pollinations AI: ${response.status} ${response.statusText} - ${errorText}`);
        }
        audioBlob = await response.blob();
        console.log('🎤 Generated audio using Pollinations AI');
      }
      
      // Store the audio blob for video generation
      setGeneratedAudioBlob(audioBlob);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Play background music at a lower volume using local file
      const bgAudio = new Audio('/sounds/pianoSound.mp3');
      bgAudio.loop = true; // Re-added to loop during story reading
      bgAudio.volume = 0.1;
      bgAudioRef.current = bgAudio;
      
      // Wait for background music to be ready before playing
      bgAudio.oncanplaythrough = () => {
        bgAudio.play().catch(e => {
          console.log('Background music play failed:', e);
        });
      };
      
      bgAudio.onerror = (e) => {
        console.log('Background music loading failed:', e);
      };
      
      // If already loaded, play immediately
      if (bgAudio.readyState >= 3) {
        bgAudio.play().catch(e => {
          console.log('Background music play failed:', e);
        });
      }

      // STEP 4: Start animation cycle ONLY if we have both story image and generated content
      if (currentStoryImage && hasGeneratedContent) {
        console.log('🎭 Starting animation cycle');
        
        // Force a small delay to ensure state is updated
        setTimeout(() => {
          setShowStoryImage(true);
          console.log('👁️ Set story image visible');
          
          // Start the alternating cycle after initial display
          setTimeout(() => {
            fadeIntervalRef.current = setInterval(() => {
              setShowStoryImage((prev) => {
                const newValue = !prev;
                console.log('🔄 Toggling story image visibility:', newValue);
                return newValue;
              });
            }, 5000); // 5 seconds for each image
            console.log('⏰ Started fade interval');
          }, 5000); // Show story image for 5 seconds first
        }, 100); // Small delay to ensure state update
      } else {
        console.log('❌ Animation not started - missing requirements:', {
          hasStoryImage: !!currentStoryImage,
          hasGeneratedContent
        });
      }

      audioRef.current = audio;
      audio.play();

      // FIXED: Enhanced audio.onended with proper cleanup
      audio.onended = () => {
        console.log('🎵 Audio ended - starting cleanup');
        
        // Stop background music 
        bgAudioRef.current?.pause();
        bgAudioRef.current = null;
        console.log('🎵 Background music stopped');
        // play confetti celebration
        celebrateWithConfetti();
        // Clean up animation and state
        cleanupStoryAnimation();
        
        // Clean up audio resources
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        console.log('✅ Audio cleanup complete');
      };
      
      // FIXED: Enhanced audio.onerror with proper cleanup
      audio.onerror = () => {
        console.log('❌ Audio error - starting cleanup');
        
        // Clean up animation and state
        cleanupStoryAnimation();
        
        // Clean up audio resources
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        
        setError("Could not play the story audio.");
        console.log('✅ Audio error cleanup complete');
      };
    } catch (err) {
      console.log('💥 Error in handleReadStory:', err);
      setError(`Could not generate audio for the story using ${storytellerType}.`);
      cleanupStoryAnimation();
    }
  };

// Generate and download video with static layout
const generateAndDownloadVideo = useCallback(async () => {
  // Check if FFmpeg is still loading
  if (ffmpegLoading) {
    setError('Video processing is still loading. Please wait a moment and try again.');
    return;
  }

  // If FFmpeg failed to load, try loading it again
  if (!ffmpegLoaded) {
    setError('Video processing not ready. Initializing...');
    try {
      await loadFFmpeg();
      if (!ffmpegLoaded) {
        setError('Failed to initialize video processing. Please refresh the page and try again.');
        return;
      }
    } catch (error) {
      setError('Failed to initialize video processing. Please refresh the page and try again.');
      return;
    }
  }

  // Double-check that FFmpeg is actually loaded
  if (!ffmpegRef.current || !ffmpegLoaded) {
    setError('Video processing not available. Please refresh the page and try again.');
    return;
  }

  if (selectedHistoryIndex === null || !history[selectedHistoryIndex]) {
    setError('Please select a drawing from your gallery first.');
    return;
  }

  if (!generatedAudioBlob) {
    setError('Please generate and play the story audio first.');
    return;
  }

  const historyItem = history[selectedHistoryIndex];
  if (!historyItem.sketch || !historyItem.generated) {
    setError('Missing required images for video generation.');
    return;
  }

  setIsGeneratingVideo(true);
  setError(null);

  try {
    const ffmpeg = ffmpegRef.current;
    
    if (!ffmpeg || !window.FFmpeg) {
      throw new Error('FFmpeg not properly initialized');
    }

    const { fetchFile } = window.FFmpeg;
    
    // Get audio duration using Web Audio API
    let audioDuration = 10; // Default fallback
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await generatedAudioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioDuration = audioBuffer.duration;
      audioContext.close();
    } catch (error) {
      console.warn('Could not get audio duration, using default:', error);
      audioDuration = Math.max(10, generatedAudioBlob.size / 16000);
    }

    // Create canvas for the video frame layout
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 1280, 720);
    
    // Create image loading promises
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // Resolve null on error to not break Promise.all
        img.src = src;
      });
    };
    
    // Load all images from the history item
    const [storyImageLoaded, sketchImageLoaded, genImageLoaded] = await Promise.all([
      historyItem.storyImageBase64 ? loadImage(`data:image/png;base64,${historyItem.storyImageBase64}`) : Promise.resolve(null),
      loadImage(`data:image/png;base64,${historyItem.sketch}`),
      loadImage(`data:image/png;base64,${historyItem.generated}`)
    ]);
    
    // Enhanced drawing function from the preview
    const drawImageWithBorder = (img, x, y, width, height, borderColor, placeholderText) => {
        // Draw background for the container
        ctx.fillStyle = '#374151'; // gray-700
        ctx.fillRect(x, y, width, height);

        // Draw border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 6; // Using a thicker border for better visibility
        ctx.strokeRect(x, y, width, height);

        // Draw image if available
        if (img) {
            const padding = 12; // Padding inside the border
            const imgX = x + padding;
            const imgY = y + padding;
            const imgW = width - padding * 2;
            const imgH = height - padding * 2;

            // Calculate aspect ratio to fit image within the container without stretching
            const containerRatio = imgW / imgH;
            const imgRatio = img.width / img.height;

            let drawW, drawH, drawX, drawY;

            if (imgRatio > containerRatio) {
                drawW = imgW;
                drawH = imgW / imgRatio;
                drawX = imgX;
                drawY = imgY + (imgH - drawH) / 2;
            } else {
                drawH = imgH;
                drawW = imgH * imgRatio;
                drawX = imgX + (imgW - drawW) / 2;
                drawY = imgY;
            }
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } else {
            // Draw placeholder text if an image is not available
            ctx.fillStyle = '#9ca3af'; // gray-400
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(placeholderText, x + width / 2, y + height / 2);
        }
    };
    
    // --- SIDE-BY-SIDE LAYOUT CALCULATIONS ---
    const PADDING = 20;
    const GAP = 20;
    const CONTAINER_COUNT = 3;
    
    const TOTAL_GAPS_WIDTH = GAP * (CONTAINER_COUNT - 1);
    const TOTAL_CONTENT_WIDTH = canvas.width - (PADDING * 2);
    const BOX_WIDTH = (TOTAL_CONTENT_WIDTH - TOTAL_GAPS_WIDTH) / CONTAINER_COUNT;

    const BOX_HEIGHT = canvas.height - (PADDING * 2);
    const BOX_Y = PADDING;

    // --- DRAWING CALLS ---
    // Draw story image (left)
    const storyX = PADDING;
    drawImageWithBorder(storyImageLoaded, storyX, BOX_Y, BOX_WIDTH, BOX_HEIGHT, '#3b82f6', 'Story Image');

    // Draw sketch image (middle)
    const sketchX = PADDING + BOX_WIDTH + GAP;
    drawImageWithBorder(sketchImageLoaded, sketchX, BOX_Y, BOX_WIDTH, BOX_HEIGHT, '#10b981', 'Sketch');
    
    // Draw generated image (right)
    const generatedX = PADDING + (BOX_WIDTH * 2) + (GAP * 2);
    drawImageWithBorder(genImageLoaded, generatedX, BOX_Y, BOX_WIDTH, BOX_HEIGHT, '#f59e0b', 'Generated Image');
    
    // Convert canvas to blob to be used by FFmpeg
    const layoutBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    // Write layout image to FFmpeg's virtual file system
    ffmpeg.FS('writeFile', 'layout.png', await fetchFile(layoutBlob));
    
    // Write audio files
    ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(generatedAudioBlob));
    
    // Use local background music file
    const bgMusicResponse = await fetch('/sounds/pianoSound.mp3');
    const bgMusicBlob = await bgMusicResponse.blob();
    ffmpeg.FS('writeFile', 'bg_music.mp3', await fetchFile(bgMusicBlob));
    
    // Create video from static image with mixed audio
    await ffmpeg.run(
      '-loop', '1', '-t', audioDuration.toString(), '-i', 'layout.png',
      '-i', 'audio.mp3',
      '-stream_loop', '-1', '-i', 'bg_music.mp3',
      '-filter_complex', `[1:a]volume=1.0[story];[2:a]volume=0.1[bg];[story][bg]amix=inputs=2:duration=first:dropout_transition=3[mixed]`,
      '-map', '0:v', '-map', '[mixed]',
      '-c:v', 'libx264', '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-shortest', '-y', 'final_video.mp4'
    );
    
    // Read the output video
    const videoData = ffmpeg.FS('readFile', 'final_video.mp4');
    const videoBlob = new Blob([videoData], { type: 'video/mp4' });
    
    // Download the video
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-story-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Celebrate successful video generation
    celebrateWithConfetti();
    playWinSound();
    
  } catch (err) {
    console.error('Error generating video:', err);
    setError(err.message || 'Failed to generate video. Please try again.');
  } finally {
    setIsGeneratingVideo(false);
  }
}, [ffmpegLoaded, ffmpegLoading, loadFFmpeg, selectedHistoryIndex, history, generatedAudioBlob, celebrateWithConfetti, playWinSound]);

  

  // History handlers
  const handleSelectHistory = (idx: number) => {
    console.log('📚 Selecting history item:', idx);
    setSelectedHistoryIndex(idx);
    const item = history[idx];
    setRecognizedImage(item.recognizedImage);
    setCurrentPrompt(item.prompt);
    setStory(item.story || "");
    
    // CRITICAL: Ensure story image is properly set from history
    const historyStoryImage = item.storyImageBase64 || null;
    setStoryImageBase64(historyStoryImage);
    console.log('🖼️ Set story image from history:', !!historyStoryImage);
    
    setHasGeneratedContent(true);

    // Draw sketch to sketchCanvas
    const sketchImg = new window.Image();
    sketchImg.onload = () => {
      const canvas = sketchCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(sketchImg, 0, 0, canvas.width, canvas.height);
        }
      }
    };
    sketchImg.src = "data:image/png;base64," + item.sketch;

    // Draw generated (pencil drawing for coloring) image to coloringCanvas
    if (item.generated) {
      const genImg = new window.Image();
      genImg.onload = () => {
        const canvas = coloringCanvasRef.current;
        if (canvas) {
          resizeColoringCanvas();
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(genImg, 0, 0, canvas.width, canvas.height);
          }
        }
      };
      genImg.src = "data:image/png;base64," + item.generated;
    }

    setShowStorySection(true);
    
  };

  const handleDeleteHistory = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((_, i) => i !== idx));
    if (selectedHistoryIndex === idx) {
      handleClearAll();
      setSelectedHistoryIndex(null);
    } else if (selectedHistoryIndex !== null && idx < selectedHistoryIndex) {
      setSelectedHistoryIndex(selectedHistoryIndex - 1);
    }
  };

  // Fixed: Improved webcam handlers
  const handleWebcamCapture = async () => {
    const video = webcamVideoRef.current;
    if (!video || !isWebcamReady) {
      setError("Camera not ready. Please wait a moment.");
      return;
    }
    
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Could not process camera image.");
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      const base64Image = await resizeBase64Image(dataUrl.split(",")[1], 200);

      // Close webcam first
      setShowWebcam(false);
      
      // Set the captured image into the drawing area
      const sketchCanvas = sketchCanvasRef.current;
      if (sketchCanvas) {
        const sketchCtx = sketchCanvas.getContext("2d");
        if (sketchCtx) {
          sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
          const img = new window.Image();
          img.onload = () => {
            sketchCtx.drawImage(img, 0, 0, sketchCanvas.width, sketchCanvas.height);
          };
          img.src = dataUrl;
        }
      }

      setIsGenerating(true);
      setError(null);
      
      const sketchDescription = await GeminiService.recognizePhoto(base64Image);
      setRecognizedImage(sketchDescription);

      const imageGenerationPrompt = `A black connected line drawing of: ${sketchDescription} for children's coloring book with no internal colors, on a plain white background.`;
      const imageBlob = await PollinationsService.generateImage(imageGenerationPrompt);
      const generatedBase64 = await blobToBase64(imageBlob);

      // Draw to coloring canvas
      setHasGeneratedContent(true);
      
      // Trigger confetti celebration for photo processing
      celebrateWithConfetti();
      playWinSound();
      
      const coloringCanvas = coloringCanvasRef.current;
      if (!coloringCanvas) return;
      resizeColoringCanvas();
      const coloringCtx = coloringCanvas.getContext("2d");
      if (coloringCtx) {
        const img = new window.Image();
        img.onload = () => {
          coloringCtx.clearRect(0, 0, coloringCanvas.width, coloringCanvas.height);
          coloringCtx.drawImage(img, 0, 0, coloringCanvas.width, coloringCanvas.height);
        };
        img.src = "data:image/png;base64," + generatedBase64;
      }

      // Add to history
      setHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            sketch: base64Image,
            generated: generatedBase64, // Initial generated image
            recognizedImage: sketchDescription,
            prompt: "[Photo]",
            story: "",
          },
        ];
        return newHistory.length > 10
          ? newHistory.slice(newHistory.length - 10)
          : newHistory;
      });
      setSelectedHistoryIndex(history.length >= 10 ? 9 : history.length);
      setShowStorySection(true);
    } catch (err: any) {
      setError(err.message || "Could not process photo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWebcamCancel = () => {
    setShowWebcam(false);
    setError(null);
  };

  return {
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
    
    // Drawing handlers
    startDrawing,
    drawSketch,
    stopDrawing,
    handleColoringClick,
    handleColoringMouseMove,
    handleColoringMouseUp,
    handleColorSelect,
    
    // Pen tool
    isPenMode,
    brushSize,
    setBrushSize,
    togglePenMode,
    
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
  };
};
