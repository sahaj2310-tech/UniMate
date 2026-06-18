import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const supportsSpeechRecognition = () =>
  typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export const supportsSpeechSynthesis = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;
