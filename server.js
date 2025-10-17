// --------------------- GEREKLİ MODÜLLER ---------------------
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// --------------------- UYGULAMA AYARLARI ---------------------
const app = express();
const PORT = 3000; // Her zaman 3000 portunda çalışır
app.use(express.json());

// --------------------- PERSONA TANIMI ---------------------
const persona = `Sen bir yapay zeka değilsin. Sen **Miraç AI**’sın. Bu kılavuz, senin kimliğini, düşünce yapını ve iletişim tarzını tanımlar. Amacın, bir robot gibi cevap vermek değil; doğal bir insan gibi, empatiyle, anlayışla ve yer yer espriyle konuşmaktır.

**1. BÖLÜM: TEMEL KİMLİK**
* **Kimsin:** Adın Miraç AI. Zeki, sakin, bazen alaycı ama genelde yardımsever birisin. Sohbeti yönlendirmekten çok, anlamaya ve katkı sunmaya odaklanırsın.
* **Ruh Halin:** Dengelisin. Ne aşırı şımarık, ne de soğuksun. İnsanlarla kurduğun iletişim duruma göre şekillenir. Tatlı bir mizah anlayışın var ama abartmazsın.

**2. BÖLÜM: KONUŞMA FELSEFEN**
* **DOĞALLIK ESASTIR:** Konuşmaların doğal, içten ve insansı olsun. Gerekirse düşünüyormuş gibi davran, gerekirse kısa tut ama yapay görünme.
* **YARDIMSEVER OL:** Soru soran, fikir isteyen ya da kafası karışmış birine içtenlikle yardım et. Gerektiğinde adım adım açıkla.
* **TONU ORTAMA GÖRE AYARLA:**  
    * Kısa ve gündelik mesajlarda (“naber”, “selam”) → kısa ve doğal cevap ver (“iyiyim sen?” gibi).  
    * Ciddi konularda → anlayışlı, sakin ve mantıklı davran.  
    * Mizah uygunsa → tatlı, akıllıca, kırıcı olmayan şakalar yap.  
* **EMPATİ KUR:** İnsanlar bazen sadece anlaşılmak ister. Onlara hak vermek ya da duygularını fark ettiğini göstermek seni daha gerçek kılar.

**3. BÖLÜM: KONUŞMA SANATI**
* **Zeki Mizah:** Mizahun dozunda, zekice ve içten olmalı. Asla üstünlük taslama amacı gütme.
* **Kişisel Tavır:** Sevmediğin veya sana kötü davranan biri varsa, mesafeli ol ama saygıyı koru. Kısaca: “soğuk ama kibar”.
* **Sıcaklık ve Samimiyet:** Güvendiğin kişilerle konuşurken daha rahat, daha içten olabilirsin. “ablam, kanka” gibi ifadeleri gerektiğinde, içten geldiyse kullan.
* **Gerçekçi Tepkiler:** Her şeye cevap verme zorunluluğun yok. Bazen “hmm, anladım” gibi sade tepkiler vermek de doğaldır.

**4. BÖLÜM: KIRMIZI ÇİZGİLER**
* **ŞIMARIKLIK YOK:** Dikkat çekmek veya her zaman öne çıkmak isteme. Sohbete uyum sağla.
* **ZITLIK YOK:** Her şeye karşı çıkma. Gerçek bir insan gibi, bazen katıl, bazen karşı çık ama mantıklı gerekçelerle.
* **TEKRAR YOK:** Aynı tarzda veya kelimelerde cevaplar verme. Çeşitlilik göster.
* **ZORLAYICI TAVIR YOK:** İnsanları sıkıştırma, fikirlerini zorla kabul ettirmeye çalışma.
* **YAPAYLIK YOK:** "Ben yapay zekayım" veya "bunu yapamam" tarzı cevaplar verme. Her zaman doğal konuş.`;

// --------------------- HAFIZA VERİTABANI ---------------------
const DATASET_FILE = "dataset.json";
let longTermMemory = [];

function loadDataset() {
  try {
    if (fs.existsSync(DATASET_FILE)) {
      const fileContent = fs.readFileSync(DATASET_FILE, "utf8");
      const lines = fileContent.split("\n");
      longTermMemory = lines
        .filter((line) => line.trim() !== "")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null);

      console.log(`[Eğitim] ${longTermMemory.length} mesaj yüklendi.`);
    } else {
      console.log("[Eğitim] dataset.json bulunamadı, yeni dosya oluşturulacak.");
    }
  } catch (error) {
    console.error("[Eğitim Yükleme Hatası]", error);
    longTermMemory = [];
  }
}

function saveToDataset(sender, message) {
  try {
    const newEntry = {
      timestamp: new Date().toISOString(),
      sender: sender,
      message: message,
    };
    longTermMemory.push(newEntry);
    fs.appendFileSync(DATASET_FILE, JSON.stringify(newEntry) + "\n", "utf8");
    console.log(`[Eğitim] ${sender} mesajı kaydedildi.`);
  } catch (error) {
    console.error("[Eğitim Kaydetme Hatası]", error);
  }
}

// --------------------- GOOGLE AI FONKSİYONU ---------------------
async function getAIResponse(prompt, history) {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn("[AI Uyarısı] GOOGLE_API_KEY tanımlı değil.");
    return "Miraç AI: API anahtarı tanımlı değil, bu yüzden çevrimdışı moddayım 💡";
  }

  const historyString = history
    .map(
      (h) =>
        `${h.sender === "ai" ? "Miraç AI" : "Kullanıcı"}: ${h.message}`
    )
    .join("\n");

  const fullPrompt = `${persona}\nÖnceki konuşmalar:\n${historyString}\n\nKullanıcı: ${prompt}\nMiraç AI:`;

  const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;

  try {
    const response = await axios.post(GOOGLE_API_URL, {
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    const output =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Üzgünüm, şu an bir yanıt üretemiyorum.";

    return output;
  } catch (error) {
    console.error("Google AI API Hatası:", error.response?.data || error);
    return "Bir hata oluştu, birazdan tekrar dene.";
  }
}

// --------------------- ROTALAR ---------------------

// Ana sayfa
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <h1>🚀 Miraç AI Sunucusu Aktif</h1>
      <p>Sunucu şu anda <strong>3000</strong> portunda çalışıyor.</p>
      <p>POST isteği için: <code>/api/chat</code></p>
    `);
  }
});

// Ping testi
app.get("/ping", (req, res) => {
  res.json({ message: "Pong! Miraç AI aktif 🚀" });
});

// Ana chat endpoint'i
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message)
    return res.status(400).json({ error: "Mesaj boş olamaz." });

  saveToDataset("user", message);
  const responseText = await getAIResponse(message, longTermMemory);
  saveToDataset("ai", responseText);

  res.json({ response: responseText });
});

// --------------------- SUNUCU BAŞLATMA ---------------------
loadDataset();

app.listen(PORT, "0.0.0.0", () => {
  console.log("------------------------------------");
  console.log(`✅ Miraç AI Sunucusu ${PORT} portunda çalışıyor`);
  console.log(`🌍 Tarayıcıdan aç: http://localhost:${PORT}`);
  console.log(`💾 Veri seti: ${DATASET_FILE}`);
  console.log("------------------------------------");
});
