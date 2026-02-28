/**
 * StudyBuddy localStorage utility
 * Per PRD Section 6: Data Model (localStorage)
 * Manages all user data persistence
 */

export interface StudyBuddyUser {
  name: string;
  avatarConfig: Record<string, string>;
  personalityPrompt: string;
  struggles: string[]; // Track wrong answers
  lastTopic: string;
  lastSection: string;
  completedSections?: string[];
  practiceResults?: PracticeResult[];
}

export interface PracticeResult {
  sectionId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timestamp: number;
}

const STORAGE_KEY = "studybuddy_user";

/**
 * Get user data from localStorage
 */
export function getUserData(): StudyBuddyUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to parse user data:", e);
    return null;
  }
}

/**
 * Save user data to localStorage.
 * Dispatches a custom event so the persistent avatar can update without navigation.
 */
export function saveUserData(user: StudyBuddyUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("studybuddy-user-updated"));
  } catch (e) {
    console.error("Failed to save user data:", e);
  }
}

/**
 * Initialize user with defaults if not exists, or update existing user
 */
export function initializeUser(
  name: string,
  avatarConfig: Record<string, string>,
  personalityPrompt: string
): StudyBuddyUser {
  const existingUser = getUserData();
  const baseUser: StudyBuddyUser = existingUser
    ? { ...existingUser }
    : {
        name: "",
        avatarConfig: {},
        personalityPrompt: "",
        struggles: [],
        lastTopic: "neural_networks",
        lastSection: "intro",
        completedSections: [],
        practiceResults: [],
      };

  const updatedUser: StudyBuddyUser = {
    ...baseUser,
    name,
    avatarConfig,
    personalityPrompt,
  };

  saveUserData(updatedUser);
  return updatedUser;
}

/**
 * Add a wrong answer to user's struggles
 * Per PRD Section 4: Memory & Reload
 */
export function addStruggle(sectionId: string): void {
  const user = getUserData();
  if (!user) return;

  if (!user.struggles.includes(sectionId)) {
    user.struggles.push(sectionId);
  }
  saveUserData(user);
}

/**
 * Record practice result
 */
export function recordPracticeResult(result: PracticeResult): void {
  const user = getUserData();
  if (!user) return;

  if (!user.practiceResults) {
    user.practiceResults = [];
  }
  user.practiceResults.push(result);

  // Keep only last 10 results to avoid bloating localStorage
  if (user.practiceResults.length > 10) {
    user.practiceResults = user.practiceResults.slice(-10);
  }

  saveUserData(user);
}

/**
 * Get user's first struggle for greeting message
 */
export function getFirstStruggle(): string | null {
  const user = getUserData();
  if (!user || !user.struggles || user.struggles.length === 0) {
    return null;
  }
  return user.struggles[0];
}

/**
 * Update last viewed section
 */
export function updateLastSection(topic: string, section: string): void {
  const user = getUserData();
  if (!user) return;

  user.lastTopic = topic;
  user.lastSection = section;
  saveUserData(user);
}

/**
 * Mark section as completed
 */
export function markSectionComplete(sectionId: string): void {
  const user = getUserData();
  if (!user) return;

  if (!user.completedSections) {
    user.completedSections = [];
  }
  if (!user.completedSections.includes(sectionId)) {
    user.completedSections.push(sectionId);
  }
  saveUserData(user);
}

/**
 * Clear all user data (for testing or reset)
 */
export function clearUserData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
