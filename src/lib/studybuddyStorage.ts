/**
 * StudyBuddy localStorage utility
 * Per PRD Section 6: Data Model (localStorage)
 * Manages all user data persistence
 */

export interface StudyBuddyUser {
  userProfile: UserProfile;
  avatarProfile: AvatarProfile;
  struggles: string[]; // Track wrong answers
  lastTopic: string;
  lastSection: string;
  completedSections?: string[];
  practiceResults?: PracticeResult[];
  /** Topic from a dashboard lesson when user opened StudyBuddy via "Practice in StudyBuddy" link */
  lessonTopicFromDashboard?: string;
}

export interface UserProfile {
  name: string;
  sex: string;
  birthday: string;
  email: string;
  profilePicture: string;
}

export interface AvatarProfile {
  avatarName: string;
  avatarConfig: Record<string, string>;
  teachingStylePrompt: string;
  tutorVoice: string;
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
const PENDING_LESSON_TOPIC_KEY = "studybuddy_pending_lesson_topic";
const RECENT_LESSON_TOPICS_KEY = "studybuddy_recent_lesson_topics";
const MAX_RECENT_LESSON_TOPICS = 10;

const DEFAULT_USER_PROFILE: UserProfile = {
  name: "",
  sex: "",
  birthday: "",
  email: "",
  profilePicture: "",
};

const DEFAULT_AVATAR_PROFILE: AvatarProfile = {
  avatarName: "",
  avatarConfig: {},
  teachingStylePrompt: "",
  tutorVoice: "English_expressive_narrator",
};

type LegacyStudyBuddyUser = {
  name?: string;
  avatarConfig?: Record<string, string>;
  personalityPrompt?: string;
  struggles?: string[];
  lastTopic?: string;
  lastSection?: string;
  completedSections?: string[];
  practiceResults?: PracticeResult[];
};

function normalizeUserData(raw: unknown): StudyBuddyUser | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  if (data.userProfile && data.avatarProfile) {
    const userProfile = data.userProfile as Partial<UserProfile>;
    const avatarProfile = data.avatarProfile as Partial<AvatarProfile>;
    return {
      userProfile: {
        ...DEFAULT_USER_PROFILE,
        ...userProfile,
      },
      avatarProfile: {
        ...DEFAULT_AVATAR_PROFILE,
        ...avatarProfile,
        avatarConfig:
          avatarProfile.avatarConfig && typeof avatarProfile.avatarConfig === "object"
            ? (avatarProfile.avatarConfig as Record<string, string>)
            : {},
      },
      struggles: Array.isArray(data.struggles) ? (data.struggles as string[]) : [],
      lastTopic: typeof data.lastTopic === "string" ? data.lastTopic : "neural_networks",
      lastSection: typeof data.lastSection === "string" ? data.lastSection : "intro",
      completedSections: Array.isArray(data.completedSections)
        ? (data.completedSections as string[])
        : [],
      practiceResults: Array.isArray(data.practiceResults)
        ? (data.practiceResults as PracticeResult[])
        : [],
      lessonTopicFromDashboard:
        typeof (data as Record<string, unknown>).lessonTopicFromDashboard === "string"
          ? (data as Record<string, unknown>).lessonTopicFromDashboard as string
          : undefined,
    };
  }

  const legacy = data as LegacyStudyBuddyUser;
  return {
    userProfile: {
      ...DEFAULT_USER_PROFILE,
      name: legacy.name ?? "",
    },
    avatarProfile: {
      ...DEFAULT_AVATAR_PROFILE,
      avatarName: legacy.name ?? "",
      avatarConfig: legacy.avatarConfig ?? {},
      teachingStylePrompt: legacy.personalityPrompt ?? "",
      tutorVoice: legacy.avatarConfig?.voiceId ?? DEFAULT_AVATAR_PROFILE.tutorVoice,
    },
    struggles: Array.isArray(legacy.struggles) ? legacy.struggles : [],
    lastTopic: legacy.lastTopic ?? "neural_networks",
    lastSection: legacy.lastSection ?? "intro",
    completedSections: Array.isArray(legacy.completedSections) ? legacy.completedSections : [],
    practiceResults: Array.isArray(legacy.practiceResults) ? legacy.practiceResults : [],
    lessonTopicFromDashboard: undefined,
  };
}

/**
 * Get user data from localStorage
 */
export function getUserData(): StudyBuddyUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return normalizeUserData(JSON.parse(data));
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
  userProfile: UserProfile,
  avatarProfile: AvatarProfile
): StudyBuddyUser {
  const existingUser = getUserData();
  const baseUser: StudyBuddyUser = existingUser
    ? { ...existingUser }
    : {
        userProfile: DEFAULT_USER_PROFILE,
        avatarProfile: DEFAULT_AVATAR_PROFILE,
        struggles: [],
        lastTopic: "neural_networks",
        lastSection: "intro",
        completedSections: [],
        practiceResults: [],
      };

  const pendingLessonTopic = getAndClearPendingLessonTopic();
  const updatedUser: StudyBuddyUser = {
    ...baseUser,
    userProfile: { ...DEFAULT_USER_PROFILE, ...userProfile },
    avatarProfile: {
      ...DEFAULT_AVATAR_PROFILE,
      ...avatarProfile,
      avatarConfig: avatarProfile.avatarConfig ?? {},
      tutorVoice: avatarProfile.tutorVoice || avatarProfile.avatarConfig?.voiceId || DEFAULT_AVATAR_PROFILE.tutorVoice,
    },
    lessonTopicFromDashboard: pendingLessonTopic ?? baseUser.lessonTopicFromDashboard,
  };

  saveUserData(updatedUser);
  return updatedUser;
}

export function clearAvatarProfile(): void {
  const user = getUserData();
  if (!user) return;
  user.avatarProfile = { ...DEFAULT_AVATAR_PROFILE };
  saveUserData(user);
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
 * Set topic from a dashboard lesson (when user opens StudyBuddy from a lesson page link).
 * Used to show "similar content" / same-topic context in StudyBuddy chat.
 * If user has no StudyBuddy data yet, stores in a pending key so it can be applied after setup.
 */
export function setLessonTopicFromDashboard(topic: string | null): void {
  const t = topic?.trim() || null;
  const user = getUserData();
  if (user) {
    user.lessonTopicFromDashboard = t ?? undefined;
    saveUserData(user);
  } else if (typeof window !== "undefined" && t) {
    try {
      localStorage.setItem(PENDING_LESSON_TOPIC_KEY, t);
    } catch {
      // ignore
    }
  }
  if (t) addToRecentLessonTopics(t);
}

/**
 * Append a lesson topic to the recent list (when student clicks Practice in StudyBuddy).
 * Used to show "Your past lessons" when they open StudyBuddy directly.
 */
export function addToRecentLessonTopics(topic: string): void {
  if (typeof window === "undefined" || !topic?.trim()) return;
  try {
    const raw = localStorage.getItem(RECENT_LESSON_TOPICS_KEY);
    const prev: string[] = raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string" && x.trim()) : [];
    const next = [topic.trim(), ...prev.filter((x) => x !== topic.trim())].slice(0, MAX_RECENT_LESSON_TOPICS);
    localStorage.setItem(RECENT_LESSON_TOPICS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * Get recent lesson topics the student opened StudyBuddy with (for "Your past lessons").
 */
export function getRecentLessonTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_LESSON_TOPICS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Consume pending lesson topic (set from lesson link before user had an account).
 * Called from initializeUser so new users get the lesson topic applied.
 */
export function getAndClearPendingLessonTopic(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const t = localStorage.getItem(PENDING_LESSON_TOPIC_KEY);
    if (t) localStorage.removeItem(PENDING_LESSON_TOPIC_KEY);
    return t;
  } catch {
    return null;
  }
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
