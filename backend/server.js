const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors()); // 允许 React 前端跨域请求
app.use(express.json());

// 配置文件上传：临时存储在 uploads 文件夹
const upload = multer({ dest: "uploads/" });

// 确保必要的文件夹存在
const dir = "./uploads/output";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
const WHISPER_PATH = path.join(
  __dirname,
  "venv",
  "Scripts",
  "whisper-ctranslate2.exe",
);
app.post("/api/transcribe", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "没有接收到音频文件" });
  }

  const inputPath = req.file.path; // Multer 生成的临时路径
  const fileName = req.file.filename;
  const outputDir = path.join(__dirname, "uploads", "output", fileName);

  // 创建属于该文件的独立输出目录
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  /**
   * 构造命令：
   * --model base: 使用基础模型（速度快）
   * --language en-NZ: 针对新西兰英语优化
   * --output_format txt: 只导出文本
   * --compute_type int8: 优化 CPU 运行速度
   */
  // 在 server.js 中修改命令
  // 修改你的 command 变量

  const command = `"${WHISPER_PATH}" "${inputPath}" \
    --model base \
    --language en \
    --output_dir "${outputDir}" \
    --output_format txt \
    --compute_type int8 \
    --initial_prompt "Hello. This is a transcript, with proper punctuation, dots, and commas."`;

  console.log(`正在执行转录: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`转录错误: ${error}`);
      return res.status(500).json({ error: "语音识别失败" });
    }

    // Whisper-ctranslate2 生成的文件名通常是 [输入文件名].txt
    const resultFilePath = path.join(outputDir, `${fileName}.txt`);

    try {
      if (fs.existsSync(resultFilePath)) {
        const transcription = fs.readFileSync(resultFilePath, "utf8");

        // 成功后清理临时文件
        //cleanupFiles(inputPath, outputDir);

        res.json({
          success: true,
          transcript: transcription.trim(),
        });
      } else {
        res.status(500).json({ error: "转录文件未生成" });
      }
    } catch (readError) {
      res.status(500).json({ error: "读取结果失败" });
    }
  });
});

// 清理函数：删除原始音频和生成的临时文件夹
function cleanupFiles(filePath, dirPath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(dirPath))
      fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error("清理文件失败:", err);
  }
}

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Whisper 后端已启动: http://localhost:${PORT}`);
});
