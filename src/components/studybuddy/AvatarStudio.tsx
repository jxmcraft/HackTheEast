/**
 * Avatar Studio Component
 * Human-like avatar with full appearance customization
 * Uses DiceBear Personas (human avatar style)
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { personas } from "@dicebear/collection";
import { getUserData } from "@/lib/studybuddyStorage";

/** Personas customization options */
const BODY_OPTIONS = [
  { value: "rounded", label: "Rounded" },
  { value: "squared", label: "Squared" },
  { value: "small", label: "Small" },
  { value: "checkered", label: "Checkered" },
];

const HAIR_OPTIONS = [
  { value: "long", label: "Long" },
  { value: "shortCombover", label: "Short Combover" },
  { value: "bobCut", label: "Bob Cut" },
  { value: "curly", label: "Curly" },
  { value: "bald", label: "Bald" },
  { value: "balding", label: "Balding" },
  { value: "beanie", label: "Beanie" },
  { value: "bobBangs", label: "Bob with Bangs" },
  { value: "bunUndercut", label: "Bun Undercut" },
  { value: "buzzcut", label: "Buzzcut" },
  { value: "cap", label: "Cap" },
  { value: "curlyBun", label: "Curly Bun" },
  { value: "curlyHighTop", label: "Curly High Top" },
  { value: "extraLong", label: "Extra Long" },
  { value: "fade", label: "Fade" },
  { value: "mohawk", label: "Mohawk" },
  { value: "pigtails", label: "Pigtails" },
  { value: "shortComboverChops", label: "Short Combover Chops" },
  { value: "sideShave", label: "Side Shave" },
  { value: "straightBun", label: "Straight Bun" },
];

const HAIR_COLOR_OPTIONS = [
  { value: "6c4545", label: "Dark Brown" },
  { value: "362c47", label: "Black" },
  { value: "dee1f5", label: "Blonde" },
  { value: "e15c66", label: "Auburn" },
  { value: "e16381", label: "Pink" },
  { value: "f27d65", label: "Red" },
  { value: "f29c65", label: "Orange" },
];

const EYES_OPTIONS = [
  { value: "happy", label: "Happy" },
  { value: "open", label: "Open" },
  { value: "glasses", label: "Glasses" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "wink", label: "Wink" },
  { value: "sleep", label: "Sleep" },
];

const MOUTH_OPTIONS = [
  { value: "smile", label: "Smile" },
  { value: "bigSmile", label: "Big Smile" },
  { value: "smirk", label: "Smirk" },
  { value: "lips", label: "Lips" },
  { value: "frown", label: "Frown" },
  { value: "surprise", label: "Surprise" },
];

const NOSE_OPTIONS = [
  { value: "mediumRound", label: "Medium Round" },
  { value: "smallRound", label: "Small Round" },
  { value: "wrinkles", label: "Wrinkles" },
];

const FACIAL_HAIR_OPTIONS = [
  { value: "none", label: "None" },
  { value: "shadow", label: "Shadow" },
  { value: "soulPatch", label: "Soul Patch" },
  { value: "goatee", label: "Goatee" },
  { value: "beardMustache", label: "Beard & Mustache" },
  { value: "pyramid", label: "Pyramid" },
  { value: "walrus", label: "Walrus" },
];

const SKIN_COLOR_OPTIONS = [
  { value: "eeb4a4", label: "Light" },
  { value: "e7a391", label: "Light Medium" },
  { value: "e5a07e", label: "Medium" },
  { value: "d78774", label: "Tan" },
  { value: "b16a5b", label: "Brown" },
  { value: "92594b", label: "Dark Brown" },
  { value: "623d36", label: "Dark" },
];

const CLOTHING_COLOR_OPTIONS = [
  { value: "456dff", label: "Blue" },
  { value: "6dbb58", label: "Green" },
  { value: "54d7c7", label: "Teal" },
  { value: "7555ca", label: "Purple" },
  { value: "e24553", label: "Red" },
  { value: "f3b63a", label: "Yellow" },
  { value: "f55d81", label: "Pink" },
];

const AVATAR_STYLES = [
  { value: "anime", label: "Anime", emoji: "🎌" },
  { value: "pop", label: "Pop Art", emoji: "🎨" },
  { value: "cartoon", label: "Cartoon", emoji: "✨" },
  { value: "oil", label: "Oil Painting", emoji: "🖼️" },
  { value: "watercolor", label: "Watercolor", emoji: "💧" },
  { value: "sketch", label: "Pencil Sketch", emoji: "✏️" },
  { value: "pixel", label: "Pixel Art", emoji: "👾" },
  { value: "neon", label: "Neon Cyberpunk", emoji: "🌃" },
];

const DEFAULT_AVATAR_CONFIG = {
  body: "rounded",
  hair: "long",
  hairColor: "6c4545",
  eyes: "happy",
  mouth: "smile",
  nose: "mediumRound",
  facialHair: "none",
  facialHairProbability: "0",
  skinColor: "eeb4a4",
  clothingColor: "456dff",
  avatarSource: "generated",
  customImageUrl: "",
  customStyle: "anime",
};

export interface AvatarConfig {
  name: string;
  avatarConfig: Record<string, string>;
  personalityPrompt: string;
}

/**
 * Human avatar - either DiceBear Personas or custom uploaded/styled image
 * Exported for use in VideoTeacher
 */
export function CustomAvatar({
  name,
  avatarConfig,
  size = 128,
}: {
  name: string;
  avatarConfig: Record<string, string>;
  size?: number;
}) {
  const cfg = { ...DEFAULT_AVATAR_CONFIG, ...avatarConfig };

  if (cfg.avatarSource === "upload" && cfg.customImageUrl) {
    const filter = cfg.customImageFilter ? { filter: cfg.customImageFilter } : undefined;
    return (
      <img
        src={cfg.customImageUrl}
        alt="Avatar"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={filter}
      />
    );
  }

  const dataUri = useMemo(() => {
    const options: Record<string, unknown> = {
      seed: name || "user",
      size,
      body: [cfg.body],
      hair: [cfg.hair],
      hairColor: [cfg.hairColor],
      eyes: [cfg.eyes],
      mouth: [cfg.mouth],
      nose: [cfg.nose],
      skinColor: [cfg.skinColor],
      clothingColor: [cfg.clothingColor],
      facialHairProbability: cfg.facialHair === "none" ? 0 : 100,
      randomizeIds: true,
    };
    if (cfg.facialHair && cfg.facialHair !== "none") {
      options.facialHair = [cfg.facialHair];
    }
    return createAvatar(personas, options).toDataUri();
  }, [name, avatarConfig, size]);

  return (
    <img
      src={dataUri}
      alt="Avatar"
      width={size}
      height={size}
      className="rounded-full object-cover"
    />
  );
}

export default function AvatarStudio({
  onComplete,
}: {
  onComplete?: (config: AvatarConfig) => void;
}) {
  const [name, setName] = useState("");
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [avatarConfig, setAvatarConfig] = useState<Record<string, string>>(DEFAULT_AVATAR_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("studybuddy_user");
    if (savedData) {
      try {
        const { name: savedName, avatarConfig: savedConfig, personalityPrompt: savedPrompt } = JSON.parse(savedData);
        if (savedName) setName(savedName);
        if (savedConfig) {
          setAvatarConfig((prev) => ({ ...DEFAULT_AVATAR_CONFIG, ...prev, ...savedConfig }));
          if (savedConfig.avatarSource === "upload" && savedConfig.customImageUrl) {
            setUploadedImage(savedConfig.customImageUrl);
          }
        }
        if (savedPrompt) setPersonalityPrompt(savedPrompt);
      } catch (e) {
        console.error("Failed to load saved avatar data:", e);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (!isLoading) {
      const userData = {
        name,
        avatarConfig,
        personalityPrompt,
        struggles: getUserData()?.struggles ?? [],
        lastTopic: getUserData()?.lastTopic ?? "neural_networks",
        lastSection: getUserData()?.lastSection ?? "intro",
      };
      localStorage.setItem("studybuddy_user", JSON.stringify(userData));
    }
  }, [name, avatarConfig, personalityPrompt, isLoading]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPersonalityPrompt(e.target.value);
  };

  const handleAvatarChange = (key: string, value: string) => {
    setAvatarConfig((prev) => ({ ...prev, [key]: value }));
  };

  const resizeImage = (file: File, maxSize = 384): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas context failed"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select an image file (JPEG, PNG, etc.)");
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setUploadedImage(dataUrl);
      handleAvatarChange("avatarSource", "upload");
      handleAvatarChange("customImageUrl", dataUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to process image");
    }
    e.target.value = "";
  };

  const handleApplyStyle = async () => {
    const sourceImage = uploadedImage || avatarConfig.customImageUrl;
    if (!sourceImage) return;
    setStyleLoading(true);
    setStyleError(null);
    try {
      const res = await fetch("/api/generate/avatar-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: sourceImage,
          style: avatarConfig.customStyle || "anime",
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setAvatarConfig((prev) => ({
          ...prev,
          customImageUrl: data.imageUrl,
          customImageFilter: "",
        }));
      } else {
        setStyleError(data.error || "API unavailable");
        // Fallback: apply client-side CSS filter for instant feedback
        const filter = getFallbackFilter(avatarConfig.customStyle || "anime");
        if (filter) {
          setAvatarConfig((prev) => ({ ...prev, customImageFilter: filter }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setStyleError(msg);
      console.error("Style transfer failed:", err);
      const filter = getFallbackFilter(avatarConfig.customStyle || "anime");
      if (filter) {
        setAvatarConfig((prev) => ({ ...prev, customImageFilter: filter }));
      }
    } finally {
      setStyleLoading(false);
    }
  };

  function getFallbackFilter(style: string): string {
    const filters: Record<string, string> = {
      anime: "saturate(1.3) contrast(1.1)",
      pop: "contrast(1.4) saturate(1.5)",
      sketch: "grayscale(1) contrast(1.1)",
      oil: "saturate(0.8) contrast(1.05)",
      watercolor: "saturate(1.2) hue-rotate(-5deg)",
      pixel: "contrast(1.2) saturate(1.5)",
      neon: "saturate(2) contrast(1.2)",
      cartoon: "saturate(1.3) contrast(1.1)",
    };
    return filters[style] || "";
  }

  const handleComplete = () => {
    if (!name.trim() || !personalityPrompt.trim()) {
      alert("Please enter your name and teaching style prompt");
      return;
    }
    if (onComplete) {
      onComplete({ name, avatarConfig, personalityPrompt });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-lg font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  const SelectField = ({
    label,
    value,
    onChangeKey,
    options,
  }: {
    label: string;
    value: string;
    onChangeKey: string;
    options: { value: string; label: string }[];
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => handleAvatarChange(onChangeKey, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm bg-white text-gray-900"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 text-gray-900 [color-scheme:light]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Avatar Studio</h1>
          <p className="text-lg text-gray-700">Create your human tutor avatar</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 w-full">
              <div className="flex justify-center mb-4">
                <div className="w-48 h-48 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  <CustomAvatar name={name} avatarConfig={avatarConfig} size={192} />
                </div>
              </div>
              {name && (
                <p className="text-center text-xl font-semibold text-gray-900">
                  Hi, I&apos;m {name}! 👋
                </p>
              )}
            </div>
          </div>

          {/* Right: Customization */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 placeholder:text-gray-600"
              />
            </div>

            {/* Avatar Source: Generated vs Upload */}
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <h3 className="font-semibold text-gray-900">Avatar</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleAvatarChange("avatarSource", "generated");
                    setUploadedImage(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    (avatarConfig.avatarSource || "generated") === "generated"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Generated
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    avatarConfig.avatarSource === "upload"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {avatarConfig.avatarSource === "upload" && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-700">
                    {uploadedImage ? "Choose a style to transform your photo:" : "Upload a photo first"}
                  </p>
                  <select
                    value={avatarConfig.customStyle || "anime"}
                    onChange={(e) => handleAvatarChange("customStyle", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm bg-white text-gray-900"
                  >
                    {AVATAR_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.emoji} {s.label}
                      </option>
                    ))}
                  </select>
                  {uploadedImage && (
                    <>
                      <button
                        type="button"
                        onClick={handleApplyStyle}
                        disabled={styleLoading}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {styleLoading ? "Applying style..." : "Apply Style"}
                      </button>
                      {styleError && (
                        <p className="text-xs text-red-600 mt-1">{styleError}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {(avatarConfig.avatarSource || "generated") === "generated" && (
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <h3 className="font-semibold text-gray-900">Customize Appearance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label="Body"
                  value={avatarConfig.body || DEFAULT_AVATAR_CONFIG.body}
                  onChangeKey="body"
                  options={BODY_OPTIONS}
                />
                <SelectField
                  label="Hair Style"
                  value={avatarConfig.hair || DEFAULT_AVATAR_CONFIG.hair}
                  onChangeKey="hair"
                  options={HAIR_OPTIONS}
                />
                <SelectField
                  label="Hair Color"
                  value={avatarConfig.hairColor || DEFAULT_AVATAR_CONFIG.hairColor}
                  onChangeKey="hairColor"
                  options={HAIR_COLOR_OPTIONS}
                />
                <SelectField
                  label="Skin Tone"
                  value={avatarConfig.skinColor || DEFAULT_AVATAR_CONFIG.skinColor}
                  onChangeKey="skinColor"
                  options={SKIN_COLOR_OPTIONS}
                />
                <SelectField
                  label="Eyes"
                  value={avatarConfig.eyes || DEFAULT_AVATAR_CONFIG.eyes}
                  onChangeKey="eyes"
                  options={EYES_OPTIONS}
                />
                <SelectField
                  label="Mouth"
                  value={avatarConfig.mouth || DEFAULT_AVATAR_CONFIG.mouth}
                  onChangeKey="mouth"
                  options={MOUTH_OPTIONS}
                />
                <SelectField
                  label="Nose"
                  value={avatarConfig.nose || DEFAULT_AVATAR_CONFIG.nose}
                  onChangeKey="nose"
                  options={NOSE_OPTIONS}
                />
                <SelectField
                  label="Facial Hair"
                  value={avatarConfig.facialHair || "none"}
                  onChangeKey="facialHair"
                  options={FACIAL_HAIR_OPTIONS}
                />
                <SelectField
                  label="Clothing Color"
                  value={avatarConfig.clothingColor || DEFAULT_AVATAR_CONFIG.clothingColor}
                  onChangeKey="clothingColor"
                  options={CLOTHING_COLOR_OPTIONS}
                />
              </div>
            </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Teaching Style Prompt
              </label>
              <p className="text-xs text-gray-700 mb-2">
                Describe how your tutor should teach (e.g., &quot;explain with enthusiasm, use sports analogies&quot;)
              </p>
              <textarea
                value={personalityPrompt}
                onChange={handlePersonalityChange}
                placeholder="e.g., Use sports analogies, be enthusiastic..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 placeholder:text-gray-600 resize-none"
              />
            </div>

            <button
              onClick={handleComplete}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
            >
              Start Learning
            </button>

            <p className="text-xs text-gray-600 text-center">
              {avatarConfig.avatarSource === "upload"
                ? "Style transfer by MiniMax Image API • Powered by MiniMax"
                : "Avatar by DiceBear Personas • Powered by MiniMax abab6.5"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
