import React, { useState, useRef } from 'react';
import { Upload, Mic, Play, Pause, Activity, AlertCircle, CheckCircle2, Music, Wind, TrendingUp, Loader2, Download } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import html2canvas from 'html2canvas';

// Initialize Gemini API
// 强制使用 Vite 的语法读取环境变量
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// 初始化 AI，并强行把请求地址改为中转平台
const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
        baseUrl: "https://api.gptsapi.net"
    }
});

interface AnalysisResult {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  pitchAnalysis: string;
  rhythmAnalysis: string;
  emotionAndTone: string;
  actionableAdvice: string[];
  summary: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER, description: "总体评分（0-100分）" },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5个主要优势的列表（中文）" },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5个主要弱点或改进空间的列表（中文）" },
    pitchAnalysis: { type: Type.STRING, description: "对音准和语调的详细分析（中文）" },
    rhythmAnalysis: { type: Type.STRING, description: "对节奏、节拍和速度的详细分析（中文）" },
    emotionAndTone: { type: Type.STRING, description: "对情感、音色、共鸣和气息控制的分析（中文）" },
    actionableAdvice: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5条可操作的改进建议（中文）" },
    summary: { type: Type.STRING, description: "对整体表现的简短总结（中文）" }
  },
  required: ["overallScore", "strengths", "weaknesses", "pitchAnalysis", "rhythmAnalysis", "emotionAndTone", "actionableAdvice", "summary"]
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('无法读取文件'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courseDay, setCourseDay] = useState<string>('general');
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const courseOptions = [
    { id: 'general', label: '通用点评' },
    { id: 'day1', label: 'Day 1 (气息)' },
    { id: 'day2', label: 'Day 2 (音色)' },
    { id: 'day3', label: 'Day 3 (节奏)' },
    { id: 'day4', label: 'Day 4 (高音)' },
    { id: 'day5', label: 'Day 5 (情感)' },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('audio/')) {
        setError('请上传有效的音频文件（如 MP3, WAV, M4A）。');
        return;
      }
      setFile(selectedFile);
      setAudioUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.type.startsWith('audio/')) {
        setError('请上传有效的音频文件（如 MP3, WAV, M4A）。');
        return;
      }
      setFile(droppedFile);
      setAudioUrl(URL.createObjectURL(droppedFile));
      setResult(null);
      setError(null);
    }
  };

  const downloadAsImage = async () => {
    if (!resultRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        backgroundColor: '#f9fafb', // Match bg-gray-50
        useCORS: true,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = '张舒声乐点评报告.png';
      link.click();
    } catch (err) {
      console.error("生成图片失败:", err);
      setError("生成图片失败，请重试。");
    } finally {
      setIsDownloading(false);
    }
  };

  const analyzeAudio = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const base64Data = await fileToBase64(file);
      
      let extraPrompt = "";
      switch (courseDay) {
        case 'day1':
          extraPrompt = "在点评和建议中，请特别强调【气息方向诱导】的重要性。并在'actionableAdvice'（行动计划）的最后一条，务必原话加上：'可以来听第二天的课程，张舒老师会教你用被动呼吸法，解决气息不够的问题'";
          break;
        case 'day2':
          extraPrompt = "在点评和建议中，请特别强调【音色美化】的必要性。并在'actionableAdvice'（行动计划）的最后一条，务必原话加上：'来听第三天的课程，张舒老师会教你用撒娇生气法，带你掌握共鸣技巧，让你的音色更加好听'";
          break;
        case 'day3':
          extraPrompt = "在点评和建议中，请特别强调【节奏】的准确性。并在'actionableAdvice'（行动计划）的最后一条，务必原话加上：'来听第四天的课程，张舒老师会教你用逐句拍手法，带你找稳旋律节奏'";
          break;
        case 'day4':
          extraPrompt = "在点评和建议中，请特别强调【高音】的突破和技巧。并在'actionableAdvice'（行动计划）的最后一条，务必原话加上：'来听第五天的课程，张舒老师会教你四十五度弯腰高音法，带你突破高音'";
          break;
        case 'day5':
          extraPrompt = "在点评和建议中，请特别强调【情感】的投入和表达。并在'actionableAdvice'（行动计划）的最后一条，务必原话加上：'来听第六天的课程，张舒老师会教你情感三步法，带你把情感唱进旋律里'";
          break;
        default:
          extraPrompt = "请按照通用的声乐教学思路进行全面点评。";
          break;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          `你是一位专业的声乐教练，名叫张舒老师。请聆听这段清唱表演，并提供高度专业、具有建设性且详细的点评。分析其音准、节奏、音色、情感和气息控制。诚实地指出不足之处，但要多加鼓励。请务必使用中文回答，并以要求的 JSON 格式返回分析结果。\n\n${extraPrompt}`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          systemInstruction: "你是一位专业的声乐教练，名叫张舒老师。请对演唱表演提供详细、具有建设性的反馈。使用鼓励但诚实的语言。重点关注音准、节奏、气息支持、共鸣等技术方面，以及情感表达。请务必使用中文进行点评。"
        }
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as AnalysisResult;
        setResult(parsedResult);
      } else {
        throw new Error("未收到 AI 的响应。");
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "分析音频时出错，请重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">张舒声乐点评助手</h1>
          </div>
          <div className="text-sm text-gray-500 font-medium">专业清唱点评</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4">
            张舒声乐点评助手
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            上传一段您的清唱录音。张舒老师将从音准、节奏、音色等维度为您进行专业分析，并提供切实可行的提升建议。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Upload & Player */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Course Selector */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> 选择点评侧重点
              </h3>
              <div className="flex flex-wrap gap-2">
                {courseOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCourseDay(option.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      courseDay === option.id
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div 
              className={`bg-white p-8 rounded-2xl border-2 border-dashed transition-all duration-200 text-center cursor-pointer
                ${file ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="audio/*" 
                className="hidden" 
              />
              
              <div className="mx-auto w-16 h-16 mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 truncate px-4">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <button className="mt-4 text-sm text-indigo-600 font-medium hover:text-indigo-700">
                    重新选择文件
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-base font-medium text-gray-900">点击上传或将文件拖拽至此</p>
                  <p className="text-sm text-gray-500 mt-2">支持 MP3, WAV, M4A 格式，最大 20MB</p>
                  <p className="text-xs text-gray-400 mt-1">(清唱效果最佳！)</p>
                </div>
              )}
            </div>

            {audioUrl && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-gray-500" /> 预览音频
                </h3>
                <audio controls src={audioUrl} className="w-full" />
                
                <button
                  onClick={analyzeAudio}
                  disabled={isAnalyzing}
                  className={`mt-6 w-full py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2
                    ${isAnalyzing 
                      ? 'bg-indigo-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]'}`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      正在分析演唱...
                    </>
                  ) : (
                    <>
                      <Activity className="w-5 h-5" />
                      获取专业点评
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2">
            {!result && !isAnalyzing && (
              <div className="h-full min-h-[400px] bg-white rounded-2xl border border-gray-200 border-dashed flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Music className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">等待上传</h3>
                <p className="text-gray-500 mt-2 max-w-sm">
                  上传您的音频并点击分析，获取关于您演唱技巧的详细拆解。
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="h-full min-h-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center p-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                    <Mic className="w-8 h-8 text-white animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-2">正在仔细聆听...</h3>
                <p className="text-gray-500 max-w-sm">
                  张舒老师正在分析您的音准、节奏精度和音色。这通常需要 10 到 20 秒。
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-end items-center">
                  <button
                    onClick={downloadAsImage}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isDownloading ? '生成中...' : '保存为图片'}
                  </button>
                </div>

                <div ref={resultRef} className="space-y-6 bg-gray-50 p-2 sm:p-6 rounded-3xl">
                  <div className="text-center pt-2 pb-4">
                    <h2 className="text-2xl font-extrabold text-gray-900">张舒声乐点评专属报告</h2>
                    <p className="text-sm text-gray-500 mt-1">基于 AI 深度声音分析</p>
                  </div>

                  {/* Score Card */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-8">
                  <div className="relative flex-shrink-0">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="60" className="stroke-gray-100" strokeWidth="8" fill="none" />
                      <circle 
                        cx="64" cy="64" r="60" 
                        className={`stroke-current ${result.overallScore >= 80 ? 'text-green-500' : result.overallScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`} 
                        strokeWidth="8" fill="none" 
                        strokeDasharray="377" 
                        strokeDashoffset={377 - (377 * result.overallScore) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-gray-900">{result.overallScore}</span>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">评分</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">演唱总结</h3>
                    <p className="text-gray-600 leading-relaxed">{result.summary}</p>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-green-50/50 rounded-2xl border border-green-100 p-6">
                    <h4 className="text-green-800 font-bold flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-green-600" /> 主要优势
                    </h4>
                    <ul className="space-y-3">
                      {result.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-green-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-50/50 rounded-2xl border border-red-100 p-6">
                    <h4 className="text-red-800 font-bold flex items-center gap-2 mb-4">
                      <AlertCircle className="w-5 h-5 text-red-600" /> 改进空间
                    </h4>
                    <ul className="space-y-3">
                      {result.weaknesses.map((weakness, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                    <h3 className="text-lg font-bold text-gray-900">详细技术分析</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <div className="p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <div className="sm:w-1/4 shrink-0 flex items-center gap-2 text-gray-900 font-semibold">
                        <Activity className="w-5 h-5 text-indigo-500" /> 音准与语调
                      </div>
                      <div className="sm:w-3/4 text-gray-600 text-sm leading-relaxed">
                        {result.pitchAnalysis}
                      </div>
                    </div>
                    <div className="p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <div className="sm:w-1/4 shrink-0 flex items-center gap-2 text-gray-900 font-semibold">
                        <Music className="w-5 h-5 text-indigo-500" /> 节奏与节拍
                      </div>
                      <div className="sm:w-3/4 text-gray-600 text-sm leading-relaxed">
                        {result.rhythmAnalysis}
                      </div>
                    </div>
                    <div className="p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <div className="sm:w-1/4 shrink-0 flex items-center gap-2 text-gray-900 font-semibold">
                        <Wind className="w-5 h-5 text-indigo-500" /> 音色与情感
                      </div>
                      <div className="sm:w-3/4 text-gray-600 text-sm leading-relaxed">
                        {result.emotionAndTone}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actionable Advice */}
                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2 mb-6">
                    <TrendingUp className="w-6 h-6 text-indigo-600" /> 行动计划
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.actionableAdvice.map((advice, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-indigo-50 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{advice}</p>
                      </div>
                    ))}
                  </div>
                </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
