import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2 } from 'lucide-react';

function formatRecTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function RecordingWaveform() {
    return (
        <div className="pc-voice-rec__wave" aria-hidden>
            {Array.from({ length: 24 }, (_, i) => (
                <span
                    key={i}
                    className="pc-voice-rec__bar"
                    style={{ animationDelay: `${(i % 8) * 0.08}s` }}
                />
            ))}
        </div>
    );
}

/**
 * WhatsApp-style voice recorder — mic button or full recording bar.
 */
export default function PlatformChatVoiceRecorder({
    disabled = false,
    isActive = false,
    onActiveChange,
    onRecordedBlob,
}) {
    const [seconds, setSeconds] = useState(0);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const cancelledRef = useRef(false);

    const stopTracks = useCallback(() => {
        const rec = mediaRef.current;
        if (rec?.stream) {
            rec.stream.getTracks?.().forEach((t) => t.stop());
        }
        mediaRef.current = null;
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        clearTimer();
        stopTracks();
    }, [clearTimer, stopTracks]);

    const finishRecording = useCallback((send) => {
        cancelledRef.current = !send;
        if (mediaRef.current?.state === 'recording') {
            mediaRef.current.stop();
        } else {
            onActiveChange?.(false);
            clearTimer();
            stopTracks();
            setSeconds(0);
        }
    }, [clearTimer, onActiveChange, stopTracks]);

    const startRecording = async () => {
        if (disabled || isActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            cancelledRef.current = false;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const mime = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mime });
                clearTimer();
                stopTracks();
                setSeconds(0);
                onActiveChange?.(false);

                if (!cancelledRef.current && blob.size > 0) {
                    onRecordedBlob?.(blob, mime);
                }
            };

            mediaRef.current = recorder;
            recorder.start();
            onActiveChange?.(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch (e) {
            onRecordedBlob?.(null, null, e?.message || 'Microphone access denied');
            onActiveChange?.(false);
        }
    };

    if (isActive) {
        return (
            <div className="pc-voice-rec pc-voice-rec--active">
                <button
                    type="button"
                    className="pc-voice-rec__discard"
                    onClick={() => finishRecording(false)}
                    title="Cancel recording"
                    aria-label="Cancel recording"
                >
                    <Trash2 size={20} />
                </button>
                <div className="pc-voice-rec__center">
                    <span className="pc-voice-rec__dot" aria-hidden />
                    <span className="pc-voice-rec__time">{formatRecTime(seconds)}</span>
                    <RecordingWaveform />
                </div>
                <button
                    type="button"
                    className="pc-voice-rec__send"
                    onClick={() => finishRecording(true)}
                    title="Send voice message"
                    aria-label="Send voice message"
                >
                    <Send size={20} />
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            className="pc-composer-action pc-composer-action--mic"
            onClick={startRecording}
            disabled={disabled}
            title="Record voice message"
            aria-label="Record voice message"
        >
            <Mic size={22} />
        </button>
    );
}
