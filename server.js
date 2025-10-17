const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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


// --- UZUN VADELİ HAFIZA (EĞİTİM VERİTABANI) ---
const DATASET_FILE = 'dataset.json';
let longTermMemory = [];

// --- GÜVENLİ HALE GETİRİLMİŞ: VERİ SETİ YÜKLEME FONKSİYONU ---
function loadDataset() {
    try {
        if (fs.existsSync(DATASET_FILE)) {
            const fileContent = fs.readFileSync(DATASET_FILE, 'utf8');
            const lines = fileContent.split('\n'); // Dosyayı satırlara böl
            
            longTermMemory = lines
                .filter(line => line.trim() !== '') // Boş satırları atla
                .map(line => {
                    try {
                        return JSON.parse(line); // Her satırı ayrı ayrı işle
                    } catch (error) {
                        console.warn('[Eğitim Uyarısı] Bozuk bir satır atlandı:', line);
                        return null; // Bozuk satır varsa null döndür
                    }
                })
                .filter(entry => entry !== null); // Null olan (bozuk) satırları temizle

            console.log(`[Eğitim] ${longTermMemory.length} mesajlık tam veri seti yüklendi.`);
        } else {
            console.log("[Eğitim] dataset.json bulunamadı, yeni bir tane oluşturulacak.");
        }
    } catch (error) {
        console.error('[Eğitim Yükleme Hatası]', error);
        longTermMemory = []; // Genel bir hata olursa hafızayı sıfırla
    }
}

// --- GÜVENLİ HALE GETİRİLMİŞ: VERİ SETİ KAYDETME FONKSİYONU ---
function saveToDataset(sender, message) {
    try {
        const newEntry = { timestamp: new Date().toISOString(), sender: sender, message: message };
        
        // 1. Önce bellekteki diziye ekle
        longTermMemory.push(newEntry);
        
        // 2. Sadece yeni girişi JSON string'ine çevir ve sonuna bir satır sonu karakteri ekle
        const lineToAppend = JSON.stringify(newEntry) + '\n';
        
        // 3. Dosyanın sonuna ekle (overwrite etme!)
        fs.appendFileSync(DATASET_FILE, lineToAppend, 'utf8');
        
        console.log(`[Eğitim] ${sender} mesajı kaydedildi. Toplam mesaj sayısı: ${longTermMemory.length}`);
    } catch (error) {
        console.error('[Eğitim Kaydetme Hatası]', error);
    }
}

// --- YAPAY ZEKA FONKSİYONU (PERSONA İLE) ---
async function getAIResponse(prompt, history) {
    if (!process.env.GOOGLE_API_KEY) {
        console.error("[AI Hatası] Google API anahtarı bulunamadı.");
        return "Yapay zeka servisi yapılandırılmamış.";
    }
    console.log(`[AI] Yanıt oluşturuluyor... (Toplam gönderilen hafıza: ${history ? history.length : 0} mesaj)`);

    let historyString = "";
    if (history && history.length > 0) {
        historyString = "Önceki konuşma:\n" + history.map(h => `${h.role === 'model' ? 'Miraç AI' : 'Kullanıcı'}: ${h.content}`).join('\n') + "\n\n";
    }

    const fullPrompt = `${persona}\n\n${historyString}Kullanıcının son mesajı: "${prompt}"\n\nSenin cevabın:`;

    const contents = [{ role: "user", parts: [{ text: fullPrompt }] }];
    const requestBody = { contents };

    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;
    
    try {
        const response = await axios.post(GOOGLE_API_URL, requestBody);
        if (response.data.candidates && response.data.candidates[0].content && response.data.candidates[0].content.parts[0].text) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            console.error("Google AI API'den beklenmedik bir yanıt:", response.data);
            return "Üzgünüm, şu an bir yanıt oluşturamıyorum.";
        }
    } catch (error) {
        console.error("Google AI API Hatası:", error.response ? error.response.data : error.message);
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.message.includes('token')) {
            return "Kusura bakma, konuşma geçmişimiz çok kalabalık geldi. Biraz hafızamı silip yeniden başlasam mı?";
        }
        return "Bir teknik hatayla karşılaştım, kusura bakma.";
    }
}

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/api/chat', async (req, res) => {
    const { message, history: currentSessionHistory } = req.body;
    if (!message) return res.status(400).json({ error: 'Mesaj boş olamaz.' });

    saveToDataset('user', message);
    const fullHistoryForAI = [...longTermMemory.map(m => ({ role: m.sender, content: m.message })), ...currentSessionHistory];

    const lowerCasePrompt = message.toLowerCase();
    if (lowerCasePrompt.includes("hangi modeli kullanıyorsun") || lowerCasePrompt.includes("miraç ai kim")) {
        const hardcodedResponse = `Ben Miraç AI. Zaten buradayım, ne var?`;
        saveToDataset('ai', hardcodedResponse);
        return res.json({ response: hardcodedResponse });
    }

    try {
        const aiResponse = await getAIResponse(message, fullHistoryForAI);
        saveToDataset('ai', aiResponse);
        res.json({ response: aiResponse });
    } catch (error) {
        console.error("Sunucu tarafında hata:", error);
        const errorMessage = 'Bir hata oluştu, kusura bakma.';
        saveToDataset('ai', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

loadDataset();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`--- Miraç AI Sunucusu Aktif! ---`);
    console.log(`Ağdaki diğer cihazlardan erişim: http://192.168.1.3:${PORT}`);
    console.log(`Kullanılan Model: gemini-2.5-flash`);
    console.log(`Eğitim Modu: AKTİF`);
    console.log(`Persona: MİRAÇ AI (Aktif)`);
    console.log(`------------------------------------`);
});
