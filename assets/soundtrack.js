const soundtrack = document.getElementById("soundtrack");
const soundToggle = document.getElementById("sound-toggle");
const soundLabel = document.getElementById("sound-label");
const soundStatus = document.getElementById("sound-status");
const soundtrackVolume = 0.32;

let musicContext;
let loopSource;
let changingSound = false;
let useNativeAudio = !window.AudioContext || location.protocol === "file:";

function createSoundtrackLoop(context, buffer, cues) {
  const rate = buffer.sampleRate;
  const first = Math.max(0, Math.round((Number(cues.cueStart) || 0) * rate));
  const last = Math.min(buffer.length, Math.round((Number(cues.cueEnd) || buffer.duration) * rate));
  if (last <= first) throw new RangeError("Soundtrack loop cues are outside the audio buffer.");

  const requestedFade = Math.max(0, Math.round((Number(cues.crossfade) || 0) * rate));
  const overlap = Math.min(requestedFade, Math.floor((last - first) / 2));
  const fadeTail = last - overlap;
  const fadeSteps = Math.max(1, overlap - 1);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < overlap; frame += 1) {
      const angle = frame / fadeSteps * Math.PI / 2;
      const tail = samples[fadeTail + frame] * Math.cos(angle);
      const head = samples[first + frame] * Math.sin(angle);
      samples[fadeTail + frame] = tail + head;
    }
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  // The blended tail has already played the opening overlap when the loop wraps.
  source.loopStart = (first + overlap) / rate;
  source.loopEnd = last / rate;
  return { source, opening: first / rate };
}

function isSoundPlaying() {
  return useNativeAudio ? !soundtrack.paused : Boolean(loopSource && musicContext.state === "running");
}

function updateSoundButton() {
  const playing = isSoundPlaying();
  soundToggle.setAttribute("aria-pressed", String(playing));
  soundToggle.setAttribute("aria-busy", String(changingSound));
  soundLabel.textContent = playing ? "BGM 끄기" : changingSound ? "BGM 준비 중" : "BGM 켜기";
}

async function startSoundtrackLoop() {
  if (!musicContext) {
    musicContext = new AudioContext();
    musicContext.addEventListener("statechange", updateSoundButton);
  }

  const resumed = musicContext.resume();
  if (loopSource) {
    await resumed;
    return;
  }

  const [response] = await Promise.all([fetch(soundtrack.src), resumed]);
  if (!response.ok) throw new Error("Soundtrack request failed.");
  const buffer = await musicContext.decodeAudioData(await response.arrayBuffer());
  const { source, opening } = createSoundtrackLoop(musicContext, buffer, soundtrack.dataset);
  const volume = musicContext.createGain();
  volume.gain.value = soundtrackVolume;
  source.connect(volume);
  volume.connect(musicContext.destination);
  source.start(0, opening);
  loopSource = source;
}

async function toggleSound() {
  if (changingSound) return;
  const wasPlaying = isSoundPlaying();
  changingSound = true;
  soundStatus.textContent = "";
  updateSoundButton();

  try {
    if (useNativeAudio) {
      if (wasPlaying) soundtrack.pause();
      else await soundtrack.play();
    } else if (wasPlaying) {
      await musicContext.suspend();
    } else {
      await startSoundtrackLoop();
    }
  } catch {
    if (!useNativeAudio && !wasPlaying) {
      useNativeAudio = true;
      musicContext?.close().catch(() => {});
      try {
        await soundtrack.play();
      } catch {
        soundStatus.textContent = "배경음악을 재생할 수 없습니다.";
      }
    } else {
      soundStatus.textContent = "배경음악을 제어할 수 없습니다.";
    }
  } finally {
    changingSound = false;
    updateSoundButton();
  }
}

soundtrack.volume = soundtrackVolume;
soundtrack.addEventListener("playing", updateSoundButton);
soundtrack.addEventListener("pause", updateSoundButton);
soundToggle.addEventListener("click", toggleSound);
soundToggle.hidden = false;
