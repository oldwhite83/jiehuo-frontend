"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from 'qrcode.react';

interface AIResult {
  category: "free" | "minor" | "normal" | "major" | "unsolvable";
  price: number | null;
  is_resolvable: boolean;
  reason: string | null;
}

interface DivinationResult {
  original_gua: string;
  changed_gua: string;
  interpretation: string;
  plain_interpretation: string;
}

type Step = "input" | "loading" | "result" | "payment" | "gathering_info" | "divining" | "done";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [countdown, setCountdown] = useState<number>(4);
  const [step, setStep] = useState<Step>("input");
  const [result, setResult] = useState<AIResult | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("500");
  const [errorMsg, setErrorMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 支付相关状态
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);

  // 最终解卦结果
  const [divination, setDivination] = useState<DivinationResult | null>(null);
  const [showPlain, setShowPlain] = useState<boolean>(false);
  
  // 收集信息聊天状态
  const [chatMessages, setChatMessages] = useState<{role: "assistant" | "user", content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setErrorMsg("心诚则灵，请勿默不作声。");
      return;
    }
    setErrorMsg("");
    setStep("loading");

    try {
      const res = await fetch(`${getApiUrl()}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error("天道晦暗，网络请求失败");
      const data = await res.json();
      if (data.status === "success" && data.result) {
        setResult(data.result);
        setStep("result");
      } else {
        throw new Error("返回值解析异常");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "系统繁忙，请稍后再试。");
      setStep("input");
    }
  };

  const handleCreateOrder = async () => {
    let finalPrice = result?.price;
    if (result?.category === "major") {
      const amount = parseFloat(customAmount);
      if (isNaN(amount) || amount < 500) {
        alert("此事干系重大，随喜润笔不可低于500元。");
        return;
      }
      finalPrice = amount;
    }

    try {
      setStep("loading");
      const res = await fetch(`${getApiUrl()}/order/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          category: result?.category,
          price: finalPrice
        }),
      });

      if (!res.ok) throw new Error("缘分未到，订单生成失败");
      const data = await res.json();
      
      if (data.status === "success") {
        setOrderId(data.order_id);
        if (result?.category === "free" || finalPrice === 0) {
          // 免费结缘，直接自动支付并进入后续环节
          await fetch(`${getApiUrl()}/order/${data.order_id}/mock_pay`, { method: "POST" });
          initiateGatheringInfo(data.order_id);
        } else {
          setPayUrl(data.pay_url);
          setStep("payment");
          startPolling(data.order_id);
        }
      }
    } catch (err: any) {
      alert(err.message);
      setStep("result");
    }
  };

  const startPolling = (oid: string) => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${getApiUrl()}/order/${oid}/status`);
        const data = await res.json();
        if (data.status === "paid") {
          clearInterval(id);
          initiateGatheringInfo(oid);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
    setPollIntervalId(id as any);
  };

  const initiateGatheringInfo = async (oid: string) => {
    setStep("loading");
    try {
      const res = await fetch(`${getApiUrl()}/order/${oid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });
      const data = await res.json();
      if (data.status === "success") {
        if (data.result.action === "divine") {
          startDivinationAnimation(oid);
        } else {
          setChatMessages([{ role: "assistant", content: data.result.reply }]);
          setStep("gathering_info");
        }
      }
    } catch (err) {
      console.error(err);
      startDivinationAnimation(oid);
    }
  };

  // 模拟用户扫码支付成功
  const handleMockPay = async () => {
    if (!orderId) return;
    try {
      await fetch(`${getApiUrl()}/order/${orderId}/mock_pay`, { method: "POST" });
      // 轮询会自然捕获到 "paid" 状态并跳转
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !orderId) return;

    const newMsgs = [...chatMessages, { role: "user" as const, content: chatInput.trim() }];
    setChatMessages(newMsgs);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/order/${orderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await res.json();
      
      if (data.status === "success") {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.result.reply }]);
        
        // AI 判断信息收集够了，准备起卦
        if (data.result.action === "divine") {
          setTimeout(() => {
            startDivinationAnimation(orderId);
          }, 2500); // 留2.5秒给用户看最后一句话
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatLoading(false);
    }
  };
  
  useEffect(() => {
    if (step === "gathering_info") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, step]);

  const startDivinationAnimation = async (oid: string) => {
    setStep("divining");
    setCountdown(4);
    
    // 倒计时动画
    const timerId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const startTime = Date.now();
    try {
      // 提前并行请求大模型，节约整体时间
      const res = await fetch(`${getApiUrl()}/divination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: oid }),
      });
      const data = await res.json();
      
      // 计算接口耗时，确保页面至少展示完整的 4 秒倒计时动画
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 4000 - elapsed);
      
      setTimeout(() => {
        if (data.status === "success") {
          setDivination(data);
          setStep("done");
        } else {
          alert("天机受阻，解卦失败");
        }
      }, remaining);
    } catch (err) {
      console.error(err);
      clearInterval(timerId);
      alert("解卦失败，请联系贫道。");
    }
  };

  // 清理副作用
  useEffect(() => {
    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pollIntervalId]);

  const reset = () => {
    setQuestion("");
    setResult(null);
    setOrderId(null);
    setDivination(null);
    setShowPlain(false);
    setChatMessages([]);
    setChatInput("");
    if (pollIntervalId) clearInterval(pollIntervalId);
    setStep("input");
    setErrorMsg("");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F9F6F0] text-[#333333] font-serif relative">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')] pointer-events-none"></div>

      <div className="z-10 w-full max-w-2xl px-6 flex flex-col items-center">
        {step !== "divining" && step !== "done" && step !== "gathering_info" && (
          <div className="absolute top-8 left-8">
            <Link href="/" className="text-gray-500 hover:text-black tracking-widest text-sm transition-colors">
              ← 返璞归真
            </Link>
          </div>
        )}

        {/* 状态 1: 输入 */}
        {step === "input" && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <h1 className="text-3xl tracking-[0.2em] font-light text-[#2C2C2C] mb-12">施主所问何事？</h1>
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请详述心中所惑..."
                className="w-full md:w-3/4 h-32 bg-transparent border-b border-gray-400 focus:border-gray-800 outline-none resize-none text-center text-lg tracking-wider placeholder:text-gray-400 transition-colors duration-500"
                autoFocus
              ></textarea>
              {errorMsg && <p className="text-red-800 mt-4 text-sm tracking-widest">{errorMsg}</p>}
              <button type="submit" className="mt-12 group relative px-10 py-3 border border-gray-400 hover:border-gray-800 transition-colors duration-500">
                <span className="tracking-widest">叩问天机</span>
                <div className="absolute inset-0 bg-black scale-x-0 group-hover:scale-x-100 transition-transform origin-center duration-500 -z-10"></div>
                <span className="absolute inset-0 flex items-center justify-center tracking-widest text-transparent group-hover:text-white transition-colors duration-500 pointer-events-none">
                  叩问天机
                </span>
              </button>
            </form>
          </div>
        )}

        {/* 状态 2: 通用加载 */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center animate-pulse">
            <div className="w-16 h-16 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-8"></div>
            <p className="text-xl tracking-[0.3em] font-light text-gray-600">阴阳流转，天机显化中...</p>
          </div>
        )}

        {/* 状态 3: 大模型定价结果 */}
        {step === "result" && result && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full">
            {!result.is_resolvable ? (
              <div className="space-y-8">
                <h2 className="text-2xl text-[#2C2C2C] tracking-widest border-b border-gray-300 pb-4">此事难解</h2>
                <p className="text-lg text-gray-600 tracking-wider leading-relaxed max-w-lg">
                  {result.reason || "天道有常，此事非人力与卦象所能及。"}
                </p>
                <button onClick={reset} className="mt-8 px-8 py-2 border border-gray-400 text-gray-600 hover:text-black hover:border-black transition-colors tracking-widest">重新叩问</button>
              </div>
            ) : (
              <div className="space-y-8 w-full flex flex-col items-center">
                <h2 className="text-2xl text-[#2C2C2C] tracking-widest">天机已定，待结善缘</h2>
                <div className="py-8 border-y border-gray-300 w-full max-w-md">
                  {result.category === "free" && (
                    <p className="text-lg tracking-wider text-gray-700">此等微末小事，无需破费。<span className="text-2xl font-bold mx-2">免费</span>结缘</p>
                  )}
                  {result.category === "minor" && (
                    <p className="text-lg tracking-wider text-gray-700">寻常失物之事，润笔费：<span className="text-2xl font-bold mx-2">{result.price}</span>元</p>
                  )}
                  {result.category === "normal" && (
                    <p className="text-lg tracking-wider text-gray-700">常人问势之事，润笔费：<span className="text-2xl font-bold mx-2">{result.price}</span>元</p>
                  )}
                  {result.category === "major" && (
                    <div className="flex flex-col items-center space-y-6">
                      <p className="text-lg tracking-wider text-red-900 font-semibold">此事干系重大，需诚心叩问</p>
                      <div className="flex items-center space-x-2">
                        <span className="tracking-widest">随喜润笔：</span>
                        <input type="number" min="500" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="bg-transparent border-b border-gray-800 outline-none text-center w-24 text-xl font-bold py-1"/>
                        <span>元</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex space-x-6 mt-8">
                  <button onClick={reset} className="px-8 py-2 border border-gray-300 text-gray-500 hover:text-black hover:border-gray-500 transition-colors tracking-widest">再思量</button>
                  <button onClick={handleCreateOrder} className="px-8 py-2 bg-[#2C2C2C] text-white border border-[#2C2C2C] hover:bg-black transition-colors tracking-widest">
                    {result.category === "free" ? "直接解惑" : "结缘支付"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 状态 4: 支付等待区 (带模拟支付按钮) */}
        {step === "payment" && (
          <div className="flex flex-col items-center text-center animate-fade-in space-y-8">
            <h2 className="text-2xl text-[#2C2C2C] tracking-widest">请扫码结缘</h2>
            <div className="w-64 h-64 border-2 border-gray-300 bg-white flex items-center justify-center relative">
              {payUrl && payUrl.startsWith("weixin://") ? (
                <QRCodeSVG value={payUrl} size={220} />
              ) : (
                <span className="text-gray-400 tracking-widest">[ 微信二维码占位 ]</span>
              )}
              {/* 扫描线 */}
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500 opacity-50 animate-scan"></div>
            </div>
            <p className="text-sm text-gray-500 tracking-widest animate-pulse">正在静候施主结缘...</p>
            
            {/* 仅供测试的模拟支付按钮 */}
            {(!payUrl || !payUrl.startsWith("weixin://")) && (
              <div className="mt-12 pt-8 border-t border-gray-300 w-full">
                <p className="text-xs text-red-400 mb-4 tracking-widest">未配置真实密钥，降级为调试模式</p>
                <button onClick={handleMockPay} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 tracking-widest text-sm transition-colors">
                  模拟支付成功
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* 状态 4.5: 信息收集聊天 (类随便逛逛) */}
        {step === "gathering_info" && (
          <div className="w-full flex flex-col h-[80vh] bg-white bg-opacity-40 p-4 border border-gray-300 shadow-sm animate-fade-in">
            <div className="text-center pb-4 border-b border-gray-300 mb-4">
              <span className="tracking-[0.2em] font-light text-[#2C2C2C]">高人问询</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide py-4 pr-2">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-fade-in`}>
                  <div className={`max-w-[85%] px-5 py-3 leading-relaxed tracking-wider ${
                    msg.role === "user" ? "bg-[#2C2C2C] text-white" : "bg-transparent border border-gray-300 text-gray-800"
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-400 mt-2 tracking-widest">
                    {msg.role === "user" ? "施主" : "高人"}
                  </span>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex flex-col items-start animate-fade-in">
                  <div className="max-w-[85%] px-5 py-3 bg-transparent border border-gray-300 text-gray-800 flex space-x-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="pt-4 border-t border-gray-300 mt-auto">
              <form onSubmit={handleChatSubmit} className="flex space-x-4">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="诉说命理..."
                  className="flex-1 bg-transparent border-b border-gray-400 focus:border-gray-800 outline-none px-2 py-2 tracking-wider placeholder:text-gray-400 transition-colors"
                  disabled={isChatLoading}
                />
                <button 
                  type="submit" 
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-6 py-2 border border-gray-400 text-gray-600 hover:text-black hover:border-black disabled:opacity-30 transition-colors tracking-widest whitespace-nowrap"
                >
                  奉告
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 状态 5: 摇卦动画 */}
        {step === "divining" && (
          <div className="flex flex-col items-center text-center animate-fade-in h-[60vh] justify-center">
            <div className="relative w-32 h-32 mb-12">
              <div className="absolute inset-0 border-4 border-[#2C2C2C] rounded-full animate-ping opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl transform animate-[spin_3s_ease-in-out_infinite]">
                ☯
              </div>
            </div>
            <h2 className="text-2xl tracking-[0.3em] font-light text-[#2C2C2C] animate-pulse mb-8">
              屏息凝神，心中默念所求之事...
            </h2>
            <div className="text-4xl font-light text-gray-500 tracking-widest transition-opacity duration-500">
              {countdown > 0 ? countdown : "天机显化中..."}
            </div>
          </div>
        )}

        {/* 状态 6: 最终解惑报告 */}
        {step === "done" && divination && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-3xl">
            <h1 className="text-3xl tracking-[0.2em] text-[#2C2C2C] mb-8">天机显化</h1>
            
            <div className="flex items-center space-x-12 mb-10 text-xl tracking-widest font-bold text-gray-800">
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 mb-2 font-normal">本卦</span>
                <span>{divination.original_gua}</span>
              </div>
              <span className="text-gray-400">变</span>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-500 mb-2 font-normal">之卦</span>
                <span>{divination.changed_gua}</span>
              </div>
            </div>

            <div className="w-full text-left bg-white bg-opacity-40 p-8 border border-gray-300 shadow-sm leading-loose tracking-wider text-gray-700 whitespace-pre-wrap">
              {divination.interpretation}
            </div>
            
            {/* 大白话解析开关模块 */}
            <div className="w-full flex flex-col items-center mt-6">
              {!showPlain ? (
                <button 
                  onClick={() => setShowPlain(true)} 
                  className="text-sm tracking-widest text-gray-500 hover:text-[#2C2C2C] border-b border-transparent hover:border-[#2C2C2C] pb-1 transition-all duration-300"
                >
                  看不懂？听听大白话
                </button>
              ) : (
                <div className="w-full mt-4 p-6 border-l-4 border-gray-800 bg-gray-100 bg-opacity-50 text-left animate-fade-in shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg tracking-widest text-gray-800 font-bold">直白解签</h3>
                    <button 
                      onClick={() => setShowPlain(false)} 
                      className="text-xs tracking-widest text-gray-400 hover:text-gray-800"
                    >
                      [ 隐藏 ]
                    </button>
                  </div>
                  <p className="text-gray-700 tracking-wider leading-relaxed">
                    {divination.plain_interpretation}
                  </p>
                </div>
              )}
            </div>

            <button onClick={reset} className="mt-12 px-10 py-3 border border-gray-400 hover:border-gray-800 hover:bg-black hover:text-white transition-colors duration-500 tracking-widest">
              辞别高人
            </button>
          </div>
        )}

      </div>
      
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        .animate-scan { animation: scan 2s linear infinite; }
      `}</style>
    </main>
  );
}
