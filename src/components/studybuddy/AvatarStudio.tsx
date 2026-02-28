/**
 * Avatar Studio Component
 * Per PRD Section 2: Avatar Studio + Personality Prompt
 * Allows user to:
 * - Enter name
 * - Customize avatar with Avataaars
 * - Enter teaching-style personality prompt
 * - Save to localStorage
 */

"use client";

import React, { useState, useEffect } from "react";

/**
 * Simple Avatar component - shows initials in a styled circle
 * Fallback for avataaars compatibility issues
 */
function SimpleAvatar({
  name,
  avatarConfig,
}: {
  name: string;
  avatarConfig: Record<string, string>;
}) {
  // Get initials from name
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Generate a color based on the avatar config
  const colors = [
    "bg-purple-500",
    "bg-blue-500",
    "bg-pink-500",
    "bg-green-500",
    "bg-indigo-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-teal-500",
  ];
  
  const colorIndex = avatarConfig.hairColor
    ? avatarConfig.hairColor.charCodeAt(0) % colors.length
    : 0;
  const bgColor = colors[colorIndex];

  return (
    <div
      className={`w-32 h-32 ${bgColor} rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-xl border-4 border-white`}
    >
      {initials}
    </div>
  );
}

export interface AvatarConfig {
  name: string;
  avatarConfig: Record<string, string>;
  personalityPrompt: string;
}

const DEFAULT_AVATAR_CONFIG = {
  topType: "LongHairStraight",
  accessoriesType: "Prescription02",
  hairColor: "BrownDark",
  facialHairType: "Blank",
  clotheType: "BlazerShirt",
  eyeType: "Happy",
  eyebrowType: "Default",
  mouthType: "Smile",
  skinColor: "Light",
} as const;

const TOP_TYPES = [
  "NoHair",
  "Eyepatch",
  "Hat",
  "Hijab",
  "Turban",
  "WinterHat1",
  "WinterHat2",
  "WinterHat3",
  "WinterHat4",
  "LongHairBigHair",
  "LongHairBob",
  "LongHairBun",
  "LongHairCurly",
  "LongHairCurvy",
  "LongHairDreads",
  "LongHairFrida",
  "LongHairFro",
  "LongHairFroBand",
  "LongHairNotTooLong",
  "LongHairShavedSides",
  "LongHairMiaWallace",
  "LongHairStraight",
  "LongHairStraight2",
  "LongHairStraightStrand",
  "ShortHairDreads01",
  "ShortHairDreads02",
  "ShortHairFrizzle",
  "ShortHairShaggyMullet",
  "ShortHairShortCurly",
  "ShortHairShortFlat",
  "ShortHairShortRound",
  "ShortHairShortWaved",
  "ShortHairSides",
  "ShortHairTheCaesar",
  "ShortHairTheCaesarSidePart",
];

const HAIR_COLORS = [
  "Auburn",
  "Black",
  "Blonde",
  "BlondeGolden",
  "Brown",
  "BrownDark",
  "PastelPink",
  "Platinum",
  "Red",
  "SilverGray",
];

const SKIN_COLORS = ["Tanned", "Yellow", "Pale", "Light", "Brown", "DarkBrown"];

const MOUTH_TYPES = [
  "Default",
  "Concerned",
  "Disbelieving",
  "Eating",
  "Grimace",
  "Sad",
  "ScreamOpen",
  "Serious",
  "Smile",
  "Smirk",
  "Surprised",
  "Tongue",
  "Twinkle",
  "Vomit",
];

const EYE_TYPES = [
  "Close",
  "Cry",
  "Default",
  "Dizzy",
  "EyeRoll",
  "Happy",
  "Hearts",
  "Side",
  "Squint",
  "Surprised",
  "Wink",
  "WinkWacky",
];

export default function AvatarStudio({
  onComplete,
}: {
  onComplete?: (config: AvatarConfig) => void;
}) {
  const [name, setName] = useState("");
  const [personalityPrompt, setPersonalityPrompt] = useState("");
  const [avatarConfig, setAvatarConfig] = useState<Record<string, string>>(DEFAULT_AVATAR_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("studybuddy_user");
    if (savedData) {
      try {
        const { name: savedName, avatarConfig: savedConfig, personalityPrompt: savedPrompt } = JSON.parse(savedData);
        if (savedName) setName(savedName);
        if (savedConfig) setAvatarConfig(savedConfig);
        if (savedPrompt) setPersonalityPrompt(savedPrompt);
      } catch (e) {
        console.error("Failed to load saved avatar data:", e);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage whenever data changes
  const saveToLocalStorage = (newName: string, newConfig: Record<string, string>, newPrompt: string) => {
    const userData = {
      name: newName,
      avatarConfig: newConfig,
      personalityPrompt: newPrompt,
      struggles: [],
      lastTopic: "neural_networks",
      lastSection: "intro",
    };
    localStorage.setItem("studybuddy_user", JSON.stringify(userData));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    saveToLocalStorage(newName, avatarConfig, personalityPrompt);
  };

  const handlePersonalityChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPersonalityPrompt(newPrompt);
    saveToLocalStorage(name, avatarConfig, newPrompt);
  };

  const handleAvatarChange = (key: string, value: string) => {
    const newConfig = { ...avatarConfig, [key]: value };
    setAvatarConfig(newConfig);
    saveToLocalStorage(name, newConfig, personalityPrompt);
  };

  const handleComplete = () => {
    if (!name.trim() || !personalityPrompt.trim()) {
      alert("Please enter your name and personality prompt");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Avatar Studio</h1>
          <p className="text-lg text-gray-600">Create your personalized AI tutor</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 w-full">
              <div className="flex justify-center mb-4">
                <div className="w-48 h-48 bg-gradient-to-b from-purple-100 to-blue-100 rounded-xl flex items-center justify-center overflow-hidden">
                  <SimpleAvatar name={name} avatarConfig={avatarConfig} />
                </div>
              </div>
              {name && (
                <p className="text-center text-xl font-semibold text-gray-800">
                  Hi, I&apos;m {name}! 👋
                </p>
              )}
            </div>
          </div>

          {/* Right: Customization Controls */}
          <div className="space-y-6">
            {/* Name Input */}
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Avatar Customization */}
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <h3 className="font-semibold text-gray-800">Customize Avatar</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hair Style
                </label>
                <select
                  value={avatarConfig.topType}
                  onChange={(e) => handleAvatarChange("topType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {TOP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hair Color
                </label>
                <select
                  value={avatarConfig.hairColor}
                  onChange={(e) => handleAvatarChange("hairColor", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {HAIR_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skin Color
                </label>
                <select
                  value={avatarConfig.skinColor}
                  onChange={(e) => handleAvatarChange("skinColor", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {SKIN_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eyes
                </label>
                <select
                  value={avatarConfig.eyeType}
                  onChange={(e) => handleAvatarChange("eyeType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {EYE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expression
                </label>
                <select
                  value={avatarConfig.mouthType}
                  onChange={(e) => handleAvatarChange("mouthType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  {MOUTH_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Personality Prompt */}
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Teaching Style Prompt
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Describe how your tutor should teach (e.g., &quot;explain with enthusiasm, use sports analogies&quot;)
              </p>
              <textarea
                value={personalityPrompt}
                onChange={handlePersonalityChange}
                placeholder="e.g., Use sports analogies, be enthusiastic, explain step-by-step..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Complete Button */}
            <button
              onClick={handleComplete}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200"
            >
              Start Learning
            </button>

            {/* Attribution */}
            <p className="text-xs text-gray-500 text-center">
              Avatar by Avataaars • Powered by MiniMax abab6.5
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
