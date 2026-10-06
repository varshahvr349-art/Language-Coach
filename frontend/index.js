


// Global State
let mediaRecorder = null;
let recordingChunks = [];
let recordedBlob = null;
let currentLanguage = null;
let currentScenario = null;
let isSpeaking = false;
let currentAudio = null;
let selectedLanguage = null;
let selectedScenario = null;

// DOM Elements
const welcomeState = document.getElementById("welcomeState");
const sessionState = document.getElementById("sessionState");
const languageSelect = document.getElementById("languageSelect");
const scenarioSelect = document.getElementById("scenarioSelect");
const beginSessionBtn = document.getElementById("beginSessionBtn");
const scenarioSection = document.getElementById("scenarioSection");
const langCards = document.querySelectorAll(".lang-card");
const scenarioOptions = document.querySelectorAll(".scenario-option");
const languageBadge = document.getElementById("languageBadge");
const scenarioBadge = document.getElementById("scenarioBadge");
const exchangeNum = document.getElementById("exchangeNum");
const speakingBubble = document.getElementById("speakingBubble");
const startSessionBtn = document.getElementById("startSessionBtn");
const recordBtn = document.getElementById("recordBtn");
const micIcon = document.getElementById("micIcon");
const stopIcon = document.getElementById("stopIcon");
const recordingStatus = document.getElementById("recordingStatus");
const submitBtn = document.getElementById("submitBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const feedbackSection = document.getElementById("feedbackSection");
const getFeedbackArea = document.getElementById("getFeedbackArea");
const getFeedbackBtn = document.getElementById("getFeedbackBtn");
const feedbackContent = document.getElementById("feedbackContent");
const feedbackLanguage = document.getElementById("feedbackLanguage");
const feedbackScenario = document.getElementById("feedbackScenario");
const fluencyCircle = document.getElementById("fluencyCircle");
const fluencyValue = document.getElementById("fluencyValue");
const grammarCircle = document.getElementById("grammarCircle");
const grammarValue = document.getElementById("grammarValue");
const vocabularyText = document.getElementById("vocabularyText");
const mistakesTable = document.getElementById("mistakesTable");
const noMistakesText = document.getElementById("noMistakesText");
const newWordsArea = document.getElementById("newWordsArea");
const conversationTipText = document.getElementById("conversationTipText");
const newSessionBtn = document.getElementById("newSessionBtn");


// ========== UI STATE FUNCTIONS ==========

function showSessionPanel(language, scenario) {
    currentLanguage = language;
    currentScenario = scenario;

    welcomeState.classList.add("hidden");
    sessionState.classList.remove("hidden");
    feedbackSection.classList.add("hidden");

    languageBadge.textContent = language;
    scenarioBadge.textContent = scenario;
    exchangeNum.textContent = "1";

    speakingBubble.classList.add("hidden");
    startSessionBtn.classList.remove("hidden");
    recordBtn.classList.add("hidden");
    recordBtn.disabled = true;
    submitBtn.disabled = true;
    endSessionBtn.disabled = true;
    recordingStatus.textContent = "Click Start Conversation to begin";
}

function updateExchangeNumber(number) {
    exchangeNum.textContent = number;
}

function showSpeakingBubble() {
    speakingBubble.classList.remove("hidden");
}

function hideSpeakingBubble() {
    speakingBubble.classList.add("hidden");
}

function enableRecording() {
    recordBtn.disabled = false;
    endSessionBtn.disabled = false;
    recordingStatus.textContent = "Click to record";
}

function disableRecording() {
    recordBtn.disabled = true;
    submitBtn.disabled = true;
    submitBtn.classList.add("hidden");
}

function showFeedbackSection() {
    feedbackSection.classList.remove("hidden");
    getFeedbackArea.classList.remove("hidden");
    feedbackContent.classList.add("hidden");
    endSessionBtn.disabled = true;
    disableRecording();
    recordingStatus.textContent = "Conversation ended";
    hideSpeakingBubble();
}

function displayFeedback(data) {
    feedbackLanguage.textContent = data.language || currentLanguage;
    feedbackScenario.textContent = data.scenario || currentScenario;

    fluencyValue.textContent = data.fluency_score || 0;
    const fluencyOffset = 251.2 - ((data.fluency_score || 0) / 10) * 251.2;
    fluencyCircle.style.strokeDashoffset = fluencyOffset;

    grammarValue.textContent = data.grammar_accuracy || 0;
    const grammarOffset = 251.2 - ((data.grammar_accuracy || 0) / 10) * 251.2;
    grammarCircle.style.strokeDashoffset = grammarOffset;

    vocabularyText.textContent = data.vocabulary_range || "Not assessed";

    // Grammar Mistakes Table
    mistakesTable.innerHTML = "";
    if (data.grammar_mistakes && data.grammar_mistakes.length > 0) {
        noMistakesText.classList.add("hidden");
        data.grammar_mistakes.forEach((mistake) => {
            if (!mistake.said || !mistake.correct || !mistake.rule) {
                return;
            }
            const row = document.createElement("tr");
            row.className = "border-b border-gray-100";
            row.innerHTML = `
                <td class="py-3 pr-4 text-red-500">${mistake.said}</td>
                <td class="py-3 pr-4 text-green-600">${mistake.correct}</td>
                <td class="py-3 text-gray-500">${mistake.rule}</td>
            `;
            mistakesTable.appendChild(row);
        });
    } else {
        noMistakesText.classList.remove("hidden");
    }

    // New Words to Learn
    newWordsArea.innerHTML = "";
    if (data.new_words_to_learn && data.new_words_to_learn.length > 0) {
        data.new_words_to_learn.forEach((word) => {
            const tag = document.createElement("span");
            tag.className = "bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-medium border border-pink-200 shadow-sm";
            tag.textContent = word;
            newWordsArea.appendChild(tag);
        });
    }

    conversationTipText.textContent = data.conversation_tip || "No tips available";

    getFeedbackArea.classList.add("hidden");
    feedbackContent.classList.remove("hidden");
}

function resetToWelcome() {
    currentLanguage = null;
    currentScenario = null;
    selectedLanguage = null;
    selectedScenario = null;
    isSpeaking = false;
    mediaRecorder = null;
    recordingChunks = [];
    recordedBlob = null;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Reset card selections
    langCards.forEach((c) => c.classList.remove("selected"));
    scenarioOptions.forEach((c) => c.classList.remove("selected"));
    scenarioSection.classList.add("hidden");
    beginSessionBtn.disabled = true;

    welcomeState.classList.remove("hidden");
    sessionState.classList.add("hidden");

    recordBtn.classList.remove("bg-red-500", "text-white", "recording-active");
    recordBtn.classList.add("bg-gray-100", "text-gray-400");
    micIcon.classList.remove("hidden");
    stopIcon.classList.add("hidden");
    submitBtn.classList.add("hidden");

    speakingBubble.classList.add("hidden");

    fluencyCircle.style.strokeDashoffset = 251.2;
    grammarCircle.style.strokeDashoffset = 251.2;
    getFeedbackBtn.textContent = "Get Feedback";
    getFeedbackBtn.disabled = false;
}


// ========== AUDIO FUNCTIONS ==========

function handleAudioStream(response, onComplete) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let mediaSource = new MediaSource();
    let audioUrl = URL.createObjectURL(mediaSource);
    let sourceBuffer;
    let queue = [];
    let isSourceBufferReady = false;

    // Show speaking bubble when streaming starts
    speakingBubble.classList.remove("hidden");
    isSpeaking = true;
    recordBtn.disabled = true;
    recordingStatus.textContent = "Listening...";

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    currentAudio = new Audio(audioUrl);
    currentAudio.play().catch((error) => {
        console.error("Audio playback failed:", error);
        recordingStatus.textContent = "Audio playback failed";
    });
 

    mediaSource.addEventListener("sourceopen", () => {
        sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        isSourceBufferReady = true;
        while (queue.length > 0 && !sourceBuffer.updating) {
            sourceBuffer.appendBuffer(queue.shift());
        }
        sourceBuffer.addEventListener("updateend", () => {
            if (queue.length > 0 && !sourceBuffer.updating) {
                sourceBuffer.appendBuffer(queue.shift());
            }
        });
    });

    function processChunk({ done, value }) {
        if (done) {
            if (mediaSource.readyState === "open") {
                try {
                    mediaSource.endOfStream();
                } catch (e) { }
            }
            if (onComplete) onComplete();
            return;
        }
        const textChunk = decoder.decode(value, { stream: true });
        textChunk.split("\n").forEach((line) => {
            if (line.trim()) {
                try {
                    const binaryString = atob(line);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    if (isSourceBufferReady && !sourceBuffer.updating) {
                        sourceBuffer.appendBuffer(bytes);
                    } else {
                        queue.push(bytes);
                    }
                } catch (e) {
                    console.error("Base64 decode error:", e);
                }
            }
        });
        reader.read().then(processChunk);
    }

    reader.read().then(processChunk);

    currentAudio.onended = () => {
        isSpeaking = false;
        speakingBubble.classList.add("hidden");
        enableRecording();
        URL.revokeObjectURL(audioUrl);
    };

    currentAudio.onerror = () => {
        isSpeaking = false;
        speakingBubble.classList.add("hidden");
        enableRecording();
        URL.revokeObjectURL(audioUrl);
    };
}


// ========== RECORDING FUNCTIONS ==========

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        recordingStatus.textContent = "Mic access denied - check permissions";
    }).then((stream) => {
        if (!stream) return;
        const options = { mimeType: "audio/webm;codecs=opus" };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = "audio/webm";
        }

        mediaRecorder = new MediaRecorder(stream, options);
        recordingChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordingChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(recordingChunks, { type: "audio/webm" });
            stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();

        recordBtn.classList.remove("bg-gray-100", "text-gray-400");
        recordBtn.classList.add("bg-red-500", "text-white", "recording-active");
        micIcon.classList.add("hidden");
        stopIcon.classList.remove("hidden");
        recordingStatus.textContent = "Recording...";
        submitBtn.classList.add("hidden");
        endSessionBtn.disabled = true;
    });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();

        recordBtn.classList.remove("bg-red-500", "text-white", "recording-active");
        recordBtn.classList.add("bg-gray-100", "text-gray-400");
        micIcon.classList.remove("hidden");
        stopIcon.classList.add("hidden");
        recordingStatus.textContent = "Recording complete";
        submitBtn.classList.remove("hidden");
        submitBtn.disabled = false;
    }
}


// ========== API FUNCTIONS ==========

const startSessionApiUrl = "http://127.0.0.1:5001/start-session";


async function startSession() {
    startSessionBtn.classList.add("hidden");
    recordBtn.classList.remove("hidden");
    recordingStatus.textContent = "Connecting...";

    try {
        const response = await fetch(startSessionApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language: currentLanguage, scenario: currentScenario })
        });

        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("text/plain")) {
            handleAudioStream(response, () => {
                endSessionBtn.disabled = false;
            });
        } else {
            enableRecording();
            endSessionBtn.disabled = false;
        }
    } catch (error) {
        recordingStatus.textContent = "Backend not connected";
        hideSpeakingBubble();
        recordBtn.classList.add("hidden");
        startSessionBtn.classList.remove("hidden");
    }
}

const submitResponseApiUrl = "http://127.0.0.1:5001/submit-response";


async function submitResponse() {
    if (!recordedBlob) return;

    disableRecording();
    recordingStatus.textContent = "Submitting...";

    const formData = new FormData();
    formData.append("audio", recordedBlob, "response.webm");

    try {
        const response = await fetch(submitResponseApiUrl, {
            method: "POST",
            body: formData
        });

        const contentType = response.headers.get("content-type");
        const isComplete = response.headers.get('X-Session-Complete') === 'true';
        const exchangeNumber = response.headers.get('X-Exchange-Number');

        if (exchangeNumber) {
            updateExchangeNumber(exchangeNumber);
        }

        if (contentType && contentType.includes("text/plain")) {
            handleAudioStream(response, () => {
                recordedBlob = null;
                recordingChunks = [];

                if (isComplete) {
                    currentAudio.onended = () => {
                        isSpeaking = false;
                        hideSpeakingBubble();
                        showFeedbackSection();
                    };
                } else {
                    endSessionBtn.disabled = false;
                }
            });
        } else {
            recordedBlob = null;
            recordingChunks = [];

            if (isComplete) {
                showFeedbackSection();
            } else {
                enableRecording();
                endSessionBtn.disabled = false;
            }
        }
    } catch (error) {
        recordingStatus.textContent = "Connection error";
        hideSpeakingBubble();
        enableRecording();
    }
}



async function endSession() {
    if (!confirm("End conversation and get feedback?")) return;

    disableRecording();
    endSessionBtn.disabled = true;
    recordingStatus.textContent = "Ending conversation...";

    await getFeedback();
}

const getFeedbackApiUrl = "http://127.0.0.1:5001/get-feedback";

async function getFeedback() {
    showFeedbackSection();
    getFeedbackBtn.textContent = "Generating...";
    getFeedbackBtn.disabled = true;

    try {
        const response = await fetch(getFeedbackApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (data.success) {
            displayFeedback(data.feedback);
        }
    } catch (error) {
        getFeedbackBtn.textContent = "Error - Retry";
        getFeedbackBtn.disabled = false;
    }
}


// ========== EVENT LISTENERS ==========

// Language card selection
langCards.forEach((card) => {
    card.addEventListener("click", () => {
        langCards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedLanguage = card.dataset.lang;
        languageSelect.value = selectedLanguage;

        // Show scenario section
        scenarioSection.classList.remove("hidden");
        scenarioSection.scrollIntoView({ behavior: "smooth", block: "start" });

        // Reset scenario selection
        selectedScenario = null;
        scenarioOptions.forEach((c) => c.classList.remove("selected"));
        beginSessionBtn.disabled = true;
    });
});

// Scenario card selection
scenarioOptions.forEach((option) => {
    option.addEventListener("click", () => {
        scenarioOptions.forEach((c) => c.classList.remove("selected"));
        option.classList.add("selected");
        selectedScenario = option.dataset.scenario;
        scenarioSelect.value = selectedScenario;
        beginSessionBtn.disabled = false;
    });
});

beginSessionBtn.addEventListener("click", () => {
    if (!selectedLanguage || !selectedScenario) return;
    showSessionPanel(selectedLanguage, selectedScenario);
});

startSessionBtn.addEventListener("click", startSession);

recordBtn.addEventListener("click", () => {
    if (isSpeaking || recordBtn.disabled) return;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        startRecording();
    } else {
        stopRecording();
    }
});

submitBtn.addEventListener("click", submitResponse);
endSessionBtn.addEventListener("click", endSession);
getFeedbackBtn.addEventListener("click", getFeedback);
newSessionBtn.addEventListener("click", resetToWelcome);

