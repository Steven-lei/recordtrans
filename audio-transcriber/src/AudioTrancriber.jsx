import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const AudioTranscriber = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // 后端处理状态
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const scrollRef = useRef(null);

  // 自动滚动逻辑
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  // 初始化浏览器自带的语音识别 (用于实时预览)
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-NZ";

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // 只有确定是 Final 的时候才放入 transcript
            final += text + " ";
          } else {
            interim += text;
          }
        }

        // 关键：确保 prev 始终被保留
        if (final) {
          setTranscript((prev) => prev + final);
        }
        setInterimTranscript(interim);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (err) {
            console.error(err);
          }
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 1. 准备 MediaRecorder 用于捕捉音频文件发送给后端
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // 2. 启动识别
      setTranscript("");
      setInterimTranscript("");
      isRecordingRef.current = true;
      setIsRecording(true);

      mediaRecorderRef.current.start();
      recognitionRef.current?.start();
    } catch (err) {
      alert("请确保已授予麦克风权限");
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimTranscript("");

    recognitionRef.current?.stop();

    // 当 MediaRecorder 停止时，触发后端上传
    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      await processWithWhisper(audioBlob);

      // 释放麦克风
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current?.stop();
  };

  // 发送给你的 Node.js + Whisper 后端
  const processWithWhisper = async (blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      // 这里的端口 5001 必须与你的后端一致
      const response = await axios.post(
        "http://localhost:5001/api/transcribe",
        formData,
      );
      // 使用后端 Whisper 的高精度结果覆盖前端预览
      setTranscript(response.data.transcript);
    } catch (err) {
      console.error("Whisper 后端失败:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: "20px", width: "90%", margin: "auto" }}>
      <h2>AI 语音助手</h2>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={isRecording ? styles.btnStop : styles.btnStart}
        >
          {isRecording ? "停止录音" : "开始录制"}
        </button>
        {isProcessing && (
          <span style={{ marginLeft: "10px" }}>
            ⚡ Whisper 正在优化转录结果...
          </span>
        )}
      </div>

      <div ref={scrollRef} style={styles.transcriptBox}>
        <div style={{ wordBreak: "break-word" }}>
          {/* 1. 始终显示已经确定的文本 */}
          <span style={{ color: "#333" }}>{transcript}</span>

          {/* 2. 只有在录音时才显示灰色的临时预览 */}
          {isRecording && (
            <span style={{ color: "#888", fontStyle: "italic" }}>
              {interimTranscript}
            </span>
          )}

          {/* 3. 后端处理时的 Loading 提示 */}
          {isProcessing && (
            <p style={{ color: "#007bff" }}>
              ⏳ Whisper 正在生成最终高精度文稿...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// 保持你之前的样式
const styles = {
  transcriptBox: {
    border: "2px solid #eee",
    padding: "20px",
    height: "400px",
    overflowY: "auto",
    backgroundColor: "#fcfcfc",
    borderRadius: "10px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "1.1rem",
    lineHeight: "1.6",
  },
  btnStart: {
    backgroundColor: "#28a745",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  btnStop: {
    backgroundColor: "#dc3545",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
};

export default AudioTranscriber;
