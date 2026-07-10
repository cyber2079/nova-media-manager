import { useState, useEffect, useRef, useCallback } from "react";

type QuoteItem = string | { text: string; face: string };

interface Props {
  quotes: QuoteItem[];
  speed?: number;
  pause?: number;
  className?: string;
  onVisibilityChange?: (visible: boolean) => void;
  onFaceChange?: (face: string) => void;
}

const poeBase = "/themes/path of exile/pic";

export default function TypewriterText({ quotes, speed = 70, pause = 1000, className, onVisibilityChange, onFaceChange }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [face, setFace] = useState("");
  const [visible, setVisible] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => { onVisibilityChange?.(visible); }, [visible, onVisibilityChange]);

  // Expose face to parent when it changes
  const faceRef = useRef(onFaceChange);
  faceRef.current = onFaceChange;

  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const typingTimer = useRef<ReturnType<typeof setInterval>>();
  const waitTimer = useRef<ReturnType<typeof setTimeout>>();
  const startedRef = useRef(false);

  const shuffleRef = useRef<QuoteItem[]>([]); // shuffled queue
  const indexRef = useRef(0);                   // position in current queue

  // Fisher-Yates shuffle
  const buildQueue = useCallback(() => {
    const arr = [...quotesRef.current];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    shuffleRef.current = arr;
    indexRef.current = 0;
  }, []);

  const pickNext = useCallback(() => {
    // Build initial queue if needed
    if (!shuffleRef.current || shuffleRef.current.length === 0) {
      buildQueue();
    }
    // Rebuild queue when we've used all items
    if (indexRef.current >= shuffleRef.current.length) {
      buildQueue();
    }
    const raw = shuffleRef.current[indexRef.current++];
    if (typeof raw === "string") return { text: raw, face: "" };
    return { text: raw.text, face: raw.face || "" };
  }, [buildQueue]);

  const startCycle = useCallback(() => {
    if (typingTimer.current) { clearInterval(typingTimer.current); typingTimer.current = undefined; }
    if (waitTimer.current) { clearTimeout(waitTimer.current); waitTimer.current = undefined; }

    const picked = pickNext();
    if (!picked.text) return;

    setDisplayed("");
    setFace(picked.face);
    faceRef.current?.(picked.face);
    setVisible(true);
    setTyping(true);

    let idx = 0;

    const startTimeout = setTimeout(() => {
      typingTimer.current = setInterval(() => {
        idx++;
        setDisplayed(picked.text.slice(0, idx));
        if (idx >= picked.text.length) {
          clearInterval(typingTimer.current!);
          typingTimer.current = undefined;
          setTyping(false);

          waitTimer.current = setTimeout(() => {
            setVisible(false);

            const delay = 5000 + Math.random() * 10000;
            waitTimer.current = setTimeout(() => {
              startCycle();
            }, delay);
          }, 15000);
        }
      }, speedRef.current);
    }, pauseRef.current);
  }, [pickNext]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startCycle();
    return () => {
      if (typingTimer.current) clearInterval(typingTimer.current);
      if (waitTimer.current) clearTimeout(waitTimer.current);
    };
  }, [startCycle]);

  if (!quotes || quotes.length === 0) return null;

  return (
    <div className="relative" style={{ minHeight: "2.5em" }}>
      <p className={className} style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        {displayed || " "}
        {typing && (
          <span className="inline-block w-0.5 h-3.5 bg-[#87ceeb]/60 ml-0.5 align-middle animate-pulse" />
        )}
      </p>
    </div>
  );
}
