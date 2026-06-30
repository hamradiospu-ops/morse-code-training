/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  Play, Square, Volume2, VolumeX, RotateCcw, CheckCircle2, XCircle, 
  Lock, Unlock, Star, Award, BookOpen, Keyboard, Settings, HelpCircle, 
  History, Save, Trash2, Copy, Moon, Sun, Activity, Info, Sparkles, 
  ArrowRight, RefreshCw, Trophy, BookMarked, User as UserIcon, Mail, LogOut, ChevronRight, Edit3,
  Eye, EyeOff, Search, Download, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { 
  MORSE_ALPHABET, 
  MORSE_NUMBERS, 
  ALL_MORSE, 
  HAM_ABBREVIATIONS, 
  textToMorse, 
  morseToText, 
  CAMPAIGN_LEVELS, 
  ACHIEVEMENTS, 
  MorseAudioEngine, 
  MorseManualKeyer,
  CampaignLevel,
  Achievement
} from './morseUtils';

import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs
} from './firebase';

interface User {
  email: string;
  name: string;
  callsign?: string;
  avatar?: string;
  password?: string;
  needsReRegistration?: boolean;
  reRegistrationReason?: string;
  registeredAt?: string;
  uid?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  createdAt?: string;
  lastLogin?: string;
}

const COMMON_DRILL_WORDS = [
  "HELLO", "WORLD", "RADIO", "SIGNAL", "CLUB", "SPU", "HAM", "CW", "TEST", "BEACON",
  "ROGER", "CALLING", "ANTENNA", "STATION", "POWER", "KEYER", "SPEED", "BEST", "SOUND", "WAVE",
  "CABLE", "DIGITAL", "VOICE", "MOBILE", "LOCAL", "HAPPY", "NIGHT", "GREEN", "SPACE", "LIGHT",
  "EARTH", "TRACK", "LEVEL", "CLOCK", "TRAIN", "HEART", "PIXEL", "AUDIO", "DRAFT", "SOLAR"
];

export default function App() {
  // --- User Account & Auth States ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = localStorage.getItem('morse_current_user');
      return val ? JSON.parse(val) : null;
    }
    return null;
  });

  const isAdmin = currentUser?.email?.toLowerCase() === "kittapat.chi@spumail.net" || currentUser?.role === "admin";

  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = localStorage.getItem('morse_registered_users');
      if (val) {
        return JSON.parse(val);
      }
      
      const defaultUsers: User[] = [
        {
          email: "kittapat.chi@spumail.net",
          name: "กิตติภัทร ชินวงศ์ (Admin)",
          callsign: "E25DUV",
          avatar: "👨‍🚀",
          password: "password123",
          role: "admin",
          needsReRegistration: false,
          registeredAt: "2026-06-25T09:30:00Z"
        },
        {
          email: "somchai.d@spumail.net",
          name: "นายสมชาย ดีใจ",
          callsign: "E29XYZ",
          avatar: "🦊",
          password: "password123",
          needsReRegistration: true,
          reRegistrationReason: "ข้อมูลใบอนุญาตวิทยุสมัครเล่นหมดอายุ กรุณาอัปโหลดใบใหม่",
          registeredAt: "2026-06-20T11:15:00Z"
        },
        {
          email: "somying.r@spumail.net",
          name: "นางสาวสมหญิง เรียนดี",
          callsign: "HS1AAA",
          avatar: "🐱",
          password: "password123",
          needsReRegistration: true,
          reRegistrationReason: "ต้องการอัปเดตสัญญาณเรียกขานหลัก (Callsign Update)",
          registeredAt: "2026-06-22T14:45:00Z"
        }
      ];
      localStorage.setItem('morse_registered_users', JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    return [];
  });

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authCallsign, setAuthCallsign] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authSuccess, setAuthSuccess] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);
  const [authSubmittingStatus, setAuthSubmittingStatus] = useState<string>("");

  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [editProfileName, setEditProfileName] = useState<string>("");
  const [editProfileCallsign, setEditProfileCallsign] = useState<string>("");
  const [editProfileAvatar, setEditProfileAvatar] = useState<string>("👨‍🚀");

  // --- Persistent States from LocalStorage ---
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_campaign_unlocked_level_${userObj.email}` : 'morse_campaign_unlocked_level';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? parseInt(val, 10) : 1;
  });

  const [highScores, setHighScores] = useState<Record<number, number>>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_campaign_high_scores_${userObj.email}` : 'morse_campaign_high_scores';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : {};
  });

  const [levelStars, setLevelStars] = useState<Record<number, number>>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_campaign_stars_${userObj.email}` : 'morse_campaign_stars';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : {};
  });

  const [savedMessages, setSavedMessages] = useState<string[]>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_saved_messages_${userObj.email}` : 'morse_saved_messages';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : [
      "CQ DE E25DUV 73",
      "SPU ARC BANGKOK",
      "73 GD DX K",
      "RST 599"
    ];
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_theme') : null;
    return (val as 'light' | 'dark') || 'dark';
  });

  // --- Game Mechanics and Difficulty Scaling ---
  const [drillLevel, setDrillLevel] = useState<1 | 2 | 3>(1);
  const [maxUnlockedDrillLevel, setMaxUnlockedDrillLevel] = useState<1 | 2 | 3>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_max_unlocked_drill_level_${userObj.email}` : 'morse_max_unlocked_drill_level';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? (parseInt(val, 10) as 1 | 2 | 3) : 1;
  });
  const [drillTimer, setDrillTimer] = useState<number | null>(null);

  // --- QRM Audio Node References ---
  const noiseSourceRef = useRef<any>(null);
  const noiseGainRef = useRef<any>(null);
  const staticBeep1Ref = useRef<any>(null);
  const staticBeep2Ref = useRef<any>(null);
  const drillTimerIntervalRef = useRef<any>(null);

  // --- Certificate Claim System States ---
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [certEmail, setCertEmail] = useState<string>("");
  const [certError, setCertError] = useState<string>("");
  const [certSuccess, setCertSuccess] = useState<string>("");

  const [fontSize, setFontSize] = useState<number>(() => {
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_font_size') : null;
    return val ? parseInt(val, 10) : 120;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('morse_font_size', fontSize.toString());
      document.documentElement.style.fontSize = `${fontSize}%`;
    }
  }, [fontSize]);

  // --- Firebase Auth & Firestore Users Sync ---
  const syncAllUsersFromFirestore = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList: User[] = [];
      querySnapshot.forEach((doc) => {
        usersList.push(doc.data() as User);
      });
      
      if (usersList.length > 0) {
        setRegisteredUsers(usersList);
        localStorage.setItem('morse_registered_users', JSON.stringify(usersList));
      }
    } catch (e) {
      console.error("Error syncing users from Firestore:", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const uid = firebaseUser.uid;
          const userDocSnap = await getDoc(doc(db, "users", uid));
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as User;
            setCurrentUser(userData);
            localStorage.setItem('morse_current_user', JSON.stringify(userData));
          } else {
            const email = firebaseUser.email || "";
            const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Google User";
            const photoURL = firebaseUser.photoURL || "";
            const userData: User = {
              uid,
              email,
              name: displayName,
              displayName,
              photoURL,
              avatar: "👨‍🚀",
              role: email.toLowerCase() === "kittapat.chi@spumail.net" ? "admin" : "user",
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              needsReRegistration: false,
              registeredAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", uid), userData);
            setCurrentUser(userData);
            localStorage.setItem('morse_current_user', JSON.stringify(userData));
          }
          await syncAllUsersFromFirestore();
        } catch (e) {
          console.error("Error restoring session from Firestore:", e);
        }
      } else {
        const cachedUserStr = localStorage.getItem('morse_current_user');
        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr) as User;
          if (cachedUser.uid) {
            setCurrentUser(null);
            localStorage.removeItem('morse_current_user');
          }
        }
      }
    });

    // Initial sync
    syncAllUsersFromFirestore();

    return () => unsubscribe();
  }, []);

  const [totalTaps, setTotalTaps] = useState<number>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_total_taps_${userObj.email}` : 'morse_total_taps';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? parseInt(val, 10) : 0;
  });

  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_completed_achievements_${userObj.email}` : 'morse_completed_achievements';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : [];
  });

  const [overallStats, setOverallStats] = useState(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_stats_${userObj.email}` : 'morse_stats';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : { totalCorrect: 0, totalRoundsPlayed: 0 };
  });

  // --- UI Layout and Settings ---
  const [activeTab, setActiveTab] = useState<'campaign' | 'custom' | 'drills' | 'keyer' | 'achievements' | 'admin'>('campaign');
  const [wpm, setWpm] = useState<number>(15);
  const [frequency, setFrequency] = useState<number>(700);

  // --- Drills Mode States ---
  const [drillType, setDrillType] = useState<'letters' | 'numbers' | 'words' | 'ham' | 'mixed'>('letters');
  const [drillTarget, setDrillTarget] = useState<string>("");
  const [userDrillInput, setUserDrillInput] = useState<string>("");
  const [drillChecked, setDrillChecked] = useState<boolean>(false);
  const [drillAttempts, setDrillAttempts] = useState<number>(1);
  const [drillHistory, setDrillHistory] = useState<{ target: string; input: string; accuracy: number; date: string }[]>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_drill_history_${userObj.email}` : 'morse_drill_history';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? JSON.parse(val) : [];
  });
  const [drillStreak, setDrillStreak] = useState<number>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_drill_streak_${userObj.email}` : 'morse_drill_streak';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? parseInt(val, 10) : 0;
  });
  const [maxDrillStreak, setMaxDrillStreak] = useState<number>(() => {
    const activeUser = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('morse_current_user') : null;
    const userObj = activeUser ? JSON.parse(activeUser) : null;
    const key = userObj ? `morse_max_drill_streak_${userObj.email}` : 'morse_max_drill_streak';
    const val = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    return val ? parseInt(val, 10) : 0;
  });
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);
  const [autoIncreaseWpm, setAutoIncreaseWpm] = useState<boolean>(false);
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");
  const [showToast, setShowToast] = useState<{ show: boolean; title: string; desc: string; icon: string } | null>(null);

  // --- Audio State tracking ---
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('morse_audio_muted') === 'true';
    }
    return false;
  });

  const toggleMute = () => {
    const newMuted = !isAudioMuted;
    setIsAudioMuted(newMuted);
    localStorage.setItem('morse_audio_muted', newMuted ? 'true' : 'false');
    if (newMuted) {
      stopPlayback();
      stopQRM();
    }
  };

  const audioEngine = useRef(new MorseAudioEngine());
  const manualKeyer = useRef(new MorseManualKeyer());
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [playbackText, setPlaybackText] = useState("");
  const [activeAudioState, setActiveAudioState] = useState({
    activeWordIndex: -1,
    activeLetterIndex: -1,
    activeSymbolIndex: -1,
    charPlaying: "",
    symbolPlaying: 'none' as 'dot' | 'dash' | 'space' | 'none'
  });

  // --- Campaign Play States ---
  const [activeLevel, setActiveLevel] = useState<CampaignLevel | null>(null);
  const [campaignRound, setCampaignRound] = useState<number>(0); // 0 to 4 (5 rounds)
  const [campaignQuestions, setCampaignQuestions] = useState<string[]>([]);
  const [campaignAnswers, setCampaignAnswers] = useState<string[]>([]);
  const [campaignScores, setCampaignScores] = useState<number[]>([]);
  const [userCampaignInput, setUserCampaignInput] = useState<string>("");
  const [campaignChecked, setCampaignChecked] = useState<boolean>(false);
  const [campaignAttempts, setCampaignAttempts] = useState<number>(1);
  const [campaignCorrect, setCampaignCorrect] = useState<boolean | null>(null);
  const [showLevelSummary, setShowLevelSummary] = useState<boolean>(false);

  // --- Custom Mode Play States ---
  const [customCategory, setCustomCategory] = useState<'letters' | 'numbers' | 'mixed' | 'abbreviations'>('letters');
  const [customLength, setCustomLength] = useState<number>(3);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [userCustomInput, setUserCustomInput] = useState<string>("");
  const [customChecked, setCustomChecked] = useState<boolean>(false);
  const [customCorrect, setCustomCorrect] = useState<boolean | null>(null);
  const [customAttempts, setCustomAttempts] = useState<number>(1);
  const [customStreak, setCustomStreak] = useState<number>(0);
  const [maxCustomStreak, setMaxCustomStreak] = useState<number>(0);

  // --- Free Tapping Simulator States ---
  const [decodedText, setDecodedText] = useState<string>("");
  const [decodedMorse, setDecodedMorse] = useState<string>("");
  const [currentLetterBuffer, setCurrentLetterBuffer] = useState<string>("");
  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);
  const [textGeneratorInput, setTextGeneratorInput] = useState<string>("WELCOME TO SPU AMATEUR RADIO CLUB");

  // Keep track of timing
  const downTimeRef = useRef<number>(0);
  const upTimeRef = useRef<number>(0);
  const letterTimerRef = useRef<number | null>(null);
  const wordTimerRef = useRef<number | null>(null);

  // Spacebar control flags to prevent document scrolling when tapping
  const isTappingTabFocused = activeTab === 'keyer';

  // --- Save persistent data on change ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_campaign_unlocked_level_${currentUser.email}` : 'morse_campaign_unlocked_level';
      localStorage.setItem(key, unlockedLevel.toString());
    }
  }, [unlockedLevel, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_campaign_high_scores_${currentUser.email}` : 'morse_campaign_high_scores';
      localStorage.setItem(key, JSON.stringify(highScores));
    }
  }, [highScores, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_campaign_stars_${currentUser.email}` : 'morse_campaign_stars';
      localStorage.setItem(key, JSON.stringify(levelStars));
    }
  }, [levelStars, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_saved_messages_${currentUser.email}` : 'morse_saved_messages';
      localStorage.setItem(key, JSON.stringify(savedMessages));
    }
  }, [savedMessages, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('morse_theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_total_taps_${currentUser.email}` : 'morse_total_taps';
      localStorage.setItem(key, totalTaps.toString());
    }
  }, [totalTaps, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_completed_achievements_${currentUser.email}` : 'morse_completed_achievements';
      localStorage.setItem(key, JSON.stringify(unlockedAchievements));
    }
  }, [unlockedAchievements, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_stats_${currentUser.email}` : 'morse_stats';
      localStorage.setItem(key, JSON.stringify(overallStats));
    }
  }, [overallStats, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_drill_history_${currentUser.email}` : 'morse_drill_history';
      localStorage.setItem(key, JSON.stringify(drillHistory));
    }
  }, [drillHistory, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_drill_streak_${currentUser.email}` : 'morse_drill_streak';
      localStorage.setItem(key, drillStreak.toString());
    }
  }, [drillStreak, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_max_drill_streak_${currentUser.email}` : 'morse_max_drill_streak';
      localStorage.setItem(key, maxDrillStreak.toString());
    }
  }, [maxDrillStreak, currentUser]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = currentUser ? `morse_max_unlocked_drill_level_${currentUser.email}` : 'morse_max_unlocked_drill_level';
      localStorage.setItem(key, maxUnlockedDrillLevel.toString());
    }
  }, [maxUnlockedDrillLevel, currentUser]);

  useEffect(() => {
    return () => {
      stopQRM();
      stopDrillTimer();
    };
  }, []);

  // --- Sync state when current user changes ---
  useEffect(() => {
    if (currentUser) {
      const email = currentUser.email;
      
      const valUnlockedLevel = localStorage.getItem(`morse_campaign_unlocked_level_${email}`);
      setUnlockedLevel(valUnlockedLevel ? parseInt(valUnlockedLevel, 10) : 1);
      
      const valHighScores = localStorage.getItem(`morse_campaign_high_scores_${email}`);
      setHighScores(valHighScores ? JSON.parse(valHighScores) : {});
      
      const valLevelStars = localStorage.getItem(`morse_campaign_stars_${email}`);
      setLevelStars(valLevelStars ? JSON.parse(valLevelStars) : {});
      
      const valSavedMessages = localStorage.getItem(`morse_saved_messages_${email}`);
      setSavedMessages(valSavedMessages ? JSON.parse(valSavedMessages) : [
        "CQ DE E25DUV 73",
        "SPU ARC BANGKOK",
        "73 GD DX K",
        "RST 599"
      ]);
      
      const valMaxUnlockedDrillLevel = localStorage.getItem(`morse_max_unlocked_drill_level_${email}`);
      setMaxUnlockedDrillLevel(valMaxUnlockedDrillLevel ? (parseInt(valMaxUnlockedDrillLevel, 10) as 1 | 2 | 3) : 1);
      
      const valTotalTaps = localStorage.getItem(`morse_total_taps_${email}`);
      setTotalTaps(valTotalTaps ? parseInt(valTotalTaps, 10) : 0);
      
      const valCompletedAchievements = localStorage.getItem(`morse_completed_achievements_${email}`);
      setUnlockedAchievements(valCompletedAchievements ? JSON.parse(valCompletedAchievements) : []);
      
      const valStats = localStorage.getItem(`morse_stats_${email}`);
      setOverallStats(valStats ? JSON.parse(valStats) : { totalCorrect: 0, totalRoundsPlayed: 0 });
      
      const valDrillHistory = localStorage.getItem(`morse_drill_history_${email}`);
      setDrillHistory(valDrillHistory ? JSON.parse(valDrillHistory) : []);
      
      const valDrillStreak = localStorage.getItem(`morse_drill_streak_${email}`);
      setDrillStreak(valDrillStreak ? parseInt(valDrillStreak, 10) : 0);
      
      const valMaxDrillStreak = localStorage.getItem(`morse_max_drill_streak_${email}`);
      setMaxDrillStreak(valMaxDrillStreak ? parseInt(valMaxDrillStreak, 10) : 0);

      setEditProfileName(currentUser.name);
      setEditProfileCallsign(currentUser.callsign || "");
      setEditProfileAvatar(currentUser.avatar || "👨‍🚀");
    } else {
      setUnlockedLevel(1);
      setHighScores({});
      setLevelStars({});
      setSavedMessages([
        "CQ DE E25DUV 73",
        "SPU ARC BANGKOK",
        "73 GD DX K",
        "RST 599"
      ]);
      setMaxUnlockedDrillLevel(1);
      setTotalTaps(0);
      setUnlockedAchievements([]);
      setOverallStats({ totalCorrect: 0, totalRoundsPlayed: 0 });
      setDrillHistory([]);
      setDrillStreak(0);
      setMaxDrillStreak(0);
    }
  }, [currentUser]);

  // --- Authentication Handlers ---
  const handleSignIn = (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const email = authEmail.toLowerCase().trim();
    const password = authPassword.trim();

    if (!email || !password) {
      setAuthError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    const user = registeredUsers.find(u => u.email === email);
    if (!user) {
      setAuthError("ไม่พบบัญชีผู้ใช้นี้ กรุณาลงทะเบียนเข้าใช้งาน");
      return;
    }

    if (user.password !== password) {
      setAuthError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const loggedUser: User = {
      ...user,
      role: email === "kittapat.chi@spumail.net" ? "admin" : (user.role || "user")
    };

    setCurrentUser(loggedUser);
    localStorage.setItem('morse_current_user', JSON.stringify(loggedUser));
    setAuthEmail("");
    setAuthPassword("");
    
    setShowToast({
      show: true,
      title: "🔓 เข้าสู่ระบบสำเร็จ",
      desc: `ยินดีต้อนรับกลับมา, ${user.name}!`,
      icon: "👋"
    });
    setTimeout(() => setShowToast(null), 3500);
  };

  const handleSignUp = (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const email = authEmail.toLowerCase().trim();
    const password = authPassword.trim();
    const name = authName.trim();
    const callsign = authCallsign.toUpperCase().trim();

    if (!name || !email || !password) {
      setAuthError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    if (password.length < 6) {
      setAuthError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    const existingUser = registeredUsers.find(u => u.email === email);
    if (existingUser) {
      setAuthError("อีเมลนี้ถูกใช้งานแล้วในระบบ");
      return;
    }

    const newUser: User = {
      email,
      password,
      name,
      callsign: callsign || undefined,
      avatar: "👨‍🚀",
      role: email === "kittapat.chi@spumail.net" ? "admin" : "user"
    };

    const newUsersList = [...registeredUsers, newUser];
    setRegisteredUsers(newUsersList);
    localStorage.setItem('morse_registered_users', JSON.stringify(newUsersList));

    setCurrentUser(newUser);
    localStorage.setItem('morse_current_user', JSON.stringify(newUser));

    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthCallsign("");

    setShowToast({
      show: true,
      title: "🎉 ลงทะเบียนสำเร็จ!",
      desc: `สร้างบัญชีและเข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${name}`,
      icon: "🚀"
    });
    setTimeout(() => setShowToast(null), 4000);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase Sign Out Error:", e);
    }
    setCurrentUser(null);
    localStorage.removeItem('morse_current_user');
    setShowProfileModal(false);
    setShowToast({
      show: true,
      title: "🔒 ออกจากระบบเรียบร้อย",
      desc: "ขอบคุณที่มาร่วมฝึกฝนกับเรา 73!",
      icon: "📡"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    if (!editProfileName.trim()) {
      setShowToast({
        show: true,
        title: "❌ เกิดข้อผิดพลาด",
        desc: "กรุณากรอกชื่อของคุณ",
        icon: "❌"
      });
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    const updatedUser: User = {
      ...currentUser,
      name: editProfileName,
      callsign: editProfileCallsign.toUpperCase().trim(),
      avatar: editProfileAvatar
    };

    if (currentUser.uid) {
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          name: editProfileName,
          displayName: editProfileName,
          callsign: editProfileCallsign.toUpperCase().trim(),
          avatar: editProfileAvatar
        });
      } catch (e) {
        console.error("Error updating profile in Firestore:", e);
      }
    }

    setCurrentUser(updatedUser);
    localStorage.setItem('morse_current_user', JSON.stringify(updatedUser));

    const updatedUsersList = registeredUsers.map(u => u.email === currentUser.email ? updatedUser : u);
    setRegisteredUsers(updatedUsersList);
    localStorage.setItem('morse_registered_users', JSON.stringify(updatedUsersList));

    setShowProfileModal(false);
    setShowToast({
      show: true,
      title: "✨ อัปเดตโปรไฟล์สำเร็จ",
      desc: "ข้อมูลโปรไฟล์ของคุณถูกบันทึกเรียบร้อยแล้ว",
      icon: "💾"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleResetUserProgress = () => {
    if (!window.confirm("คุณต้องการเริ่มต้นใหม่ทั้งหมดใช่หรือไม่? คะแนน ด่านที่ปลดล็อก และสถิติทั้งหมดจะถูกรีเซ็ตล้างค่าเป็นศูนย์")) {
      return;
    }

    setUnlockedLevel(1);
    setHighScores({});
    setLevelStars({});
    setMaxUnlockedDrillLevel(1);
    setTotalTaps(0);
    setUnlockedAchievements([]);
    setOverallStats({ totalCorrect: 0, totalRoundsPlayed: 0 });
    setDrillHistory([]);
    setDrillStreak(0);
    setMaxDrillStreak(0);

    if (currentUser) {
      const email = currentUser.email;
      localStorage.setItem(`morse_campaign_unlocked_level_${email}`, "1");
      localStorage.setItem(`morse_campaign_high_scores_${email}`, JSON.stringify({}));
      localStorage.setItem(`morse_campaign_stars_${email}`, JSON.stringify({}));
      localStorage.setItem(`morse_max_unlocked_drill_level_${email}`, "1");
      localStorage.setItem(`morse_total_taps_${email}`, "0");
      localStorage.setItem(`morse_completed_achievements_${email}`, JSON.stringify([]));
      localStorage.setItem(`morse_stats_${email}`, JSON.stringify({ totalCorrect: 0, totalRoundsPlayed: 0 }));
      localStorage.setItem(`morse_drill_history_${email}`, JSON.stringify([]));
      localStorage.setItem(`morse_drill_streak_${email}`, "0");
      localStorage.setItem(`morse_max_drill_streak_${email}`, "0");
    }

    setShowProfileModal(false);
    setShowToast({
      show: true,
      title: "🔄 รีเซ็ตสำเร็จ",
      desc: "ล้างสถิติและเริ่มต้นใหม่เรียบร้อยแล้ว!",
      icon: "🔄"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  // --- Real Google OAuth 2.0 Authentication Handlers ---
  const handleGoogleSignIn = async () => {
    setAuthError("");
    setAuthSuccess("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const uid = user.uid;
      const email = user.email || "";
      const displayName = user.displayName || user.email?.split('@')[0] || "Google User";
      const photoURL = user.photoURL || "";
      
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let userData: User;
      const isNew = !userDocSnap.exists();
      
      if (isNew) {
        userData = {
          uid,
          email,
          name: displayName,
          displayName,
          photoURL,
          avatar: "👨‍🚀",
          role: email.toLowerCase() === "kittapat.chi@spumail.net" ? "admin" : "user",
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          needsReRegistration: false,
          registeredAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userData);
      } else {
        const existingData = userDocSnap.data() as User;
        userData = {
          ...existingData,
          uid,
          email: existingData.email || email,
          name: existingData.name || existingData.displayName || displayName,
          photoURL: existingData.photoURL || photoURL,
          lastLogin: new Date().toISOString()
        };
        await updateDoc(userDocRef, {
          lastLogin: new Date().toISOString()
        });
      }

      setCurrentUser(userData);
      localStorage.setItem('morse_current_user', JSON.stringify(userData));

      await syncAllUsersFromFirestore();

      setShowToast({
        show: true,
        title: "🔓 เข้าสู่ระบบด้วย Google สำเร็จ",
        desc: `ยินดีต้อนรับคุณ ${userData.name} สู่สถานีวิทยุมอร์ส!`,
        icon: "🛡️"
      });
      setTimeout(() => setShowToast(null), 3500);

    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      setAuthError(`ไม่สามารถเข้าสู่ระบบด้วย Google ได้: ${error.message || error}`);
      setShowToast({
        show: true,
        title: "❌ เข้าสู่ระบบผิดพลาด",
        desc: error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google",
        icon: "❌"
      });
      setTimeout(() => setShowToast(null), 4000);
    }
  };

  // --- Google Sheets Registration Handlers ---
  const handleToggleReRegistration = async (email: string) => {
    const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return;

    let updatedNeedsReReg = !user.needsReRegistration;
    let reason: string | undefined = undefined;

    if (updatedNeedsReReg) {
      const res = window.prompt("กรุณาระบุเหตุผลการขอให้ลงทะเบียนใหม่ (เช่น ข้อมูลไม่ครบถ้วน, หมดอายุ, ต้องการอัปโหลดใบอนุญาต):", "ข้อมูลใบอนุญาตวิทยุสมัครเล่นหมดอายุ กรุณาลงทะเบียนอัปเดตใหม่");
      if (res === null) return;
      reason = res;
    }

    if (user.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          needsReRegistration: updatedNeedsReReg,
          reRegistrationReason: reason || null
        });
      } catch (e) {
        console.error("Error updating re-registration status in Firestore:", e);
      }
    }

    const updated = registeredUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return {
          ...u,
          needsReRegistration: updatedNeedsReReg,
          reRegistrationReason: reason
        };
      }
      return u;
    });

    setRegisteredUsers(updated);
    localStorage.setItem('morse_registered_users', JSON.stringify(updated));

    if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
      const updatedCurrentUser = updated.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
      setCurrentUser(updatedCurrentUser);
      if (updatedCurrentUser) {
        localStorage.setItem('morse_current_user', JSON.stringify(updatedCurrentUser));
      }
    }

    setShowToast({
      show: true,
      title: "📊 อัปเดตสถานะสำเร็จ",
      desc: updatedNeedsReReg 
        ? `ส่งคำขอให้ลงทะเบียนใหม่สำหรับผู้ใช้ ${email} เรียบร้อย`
        : `ยกเลิกคำขอลงทะเบียนใหม่สำหรับผู้ใช้ ${email} แล้ว`,
      icon: updatedNeedsReReg ? "⚠️" : "💚"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleExportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ลำดับที่,ชื่อ-นามสกุล,อีเมล,สัญญาณเรียกขาน,วันที่ลงทะเบียน,สถานะ,หมายเหตุ\n";
    
    registeredUsers.forEach((user, index) => {
      const statusText = user.needsReRegistration ? "ควรลงทะเบียนใหม่" : "ลงทะเบียนเรียบร้อย";
      const reasonText = user.reRegistrationReason || "-";
      const regDate = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('th-TH') : "ไม่ระบุ";
      csvContent += `${index + 1},"${user.name}","${user.email}","${user.callsign || "-"}","${regDate}","${statusText}","${reasonText}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `spu_morse_registration_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowToast({
      show: true,
      title: "📥 ส่งออกข้อมูลสำเร็จ",
      desc: "ดาวน์โหลดไฟล์รายงาน CSV สำหรับ Google Sheets เรียบร้อยแล้ว!",
      icon: "🟢"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleAdminUpdateCallsign = async (email: string) => {
    const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return;
    const newCall = window.prompt(`แก้ไขสัญญาณเรียกขานของ ${user.name}:`, user.callsign || "");
    if (newCall === null) return;
    const cleanedCall = newCall.toUpperCase().trim();
    
    if (user.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          callsign: cleanedCall || null
        });
      } catch (e) {
        console.error("Error updating callsign in Firestore:", e);
      }
    }
    
    const updatedList = registeredUsers.map(u => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, callsign: cleanedCall || undefined };
      }
      return u;
    });
    setRegisteredUsers(updatedList);
    localStorage.setItem('morse_registered_users', JSON.stringify(updatedList));
    
    if (currentUser?.email.toLowerCase() === email.toLowerCase()) {
      const updatedSelf = { ...currentUser, callsign: cleanedCall || undefined };
      setCurrentUser(updatedSelf);
      localStorage.setItem('morse_current_user', JSON.stringify(updatedSelf));
    }

    setShowToast({
      show: true,
      title: "📡 อัปเดตสัญญาณเรียกขาน",
      desc: `อัปเดตสัญญาณเรียกขานของ ${user.name} เป็น ${cleanedCall || "ไม่มี"} สำเร็จ`,
      icon: "✅"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleAdminDeleteUser = async (email: string) => {
    if (email.toLowerCase() === "kittapat.chi@spumail.net") {
      alert("ไม่สามารถลบบัญชีแอดมินหลักได้!");
      return;
    }
    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${email} ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้!`);
    if (!confirmDelete) return;

    const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.uid) {
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (e) {
        console.error("Error deleting user from Firestore:", e);
      }
    }

    const updatedList = registeredUsers.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    setRegisteredUsers(updatedList);
    localStorage.setItem('morse_registered_users', JSON.stringify(updatedList));

    setShowToast({
      show: true,
      title: "🗑️ ลบสมาชิกสำเร็จ",
      desc: `ลบสมาชิก ${email} เรียบร้อยแล้ว`,
      icon: "⚠️"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  // --- Trigger Achievements Check ---
  const triggerAchievementUnlock = (id: string) => {
    if (unlockedAchievements.includes(id)) return;
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      const updated = [...unlockedAchievements, id];
      setUnlockedAchievements(updated);
      
      // Toast notification
      setShowToast({
        show: true,
        title: `🔓 ปลดล็อกความสำเร็จ: ${achievement.thaiTitle}`,
        desc: achievement.thaiDescription,
        icon: achievement.icon
      });

      // Beep notification sequence
      setTimeout(() => {
        const dummyKeyer = new MorseManualKeyer();
        dummyKeyer.startBeep(880);
        setTimeout(() => {
          dummyKeyer.stopBeep();
          setTimeout(() => {
            dummyKeyer.startBeep(1100);
            setTimeout(() => dummyKeyer.stopBeep(), 80);
          }, 80);
        }, 80);
      }, 500);

      // Dismiss toast after 5s
      setTimeout(() => {
        setShowToast(null);
      }, 5000);
    }
  };

  // --- Check stats-based achievements ---
  useEffect(() => {
    if (overallStats.totalRoundsPlayed >= 1) {
      triggerAchievementUnlock('first_dot');
    }
    if (unlockedLevel >= 3) {
      triggerAchievementUnlock('campaign_star');
    }
    if (wpm >= 20 && isPlayingSound) {
      triggerAchievementUnlock('speed_demon');
    }
  }, [overallStats.totalRoundsPlayed, unlockedLevel, wpm, isPlayingSound]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.current.stop();
      manualKeyer.current.stopBeep();
      if (letterTimerRef.current) clearTimeout(letterTimerRef.current);
      if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
    };
  }, []);

  // --- Play Beep on single Letter in Reference Guide ---
  const playLetterBeep = (char: string) => {
    const code = ALL_MORSE[char];
    if (code) {
      setPlaybackText(char);
      audioEngine.current.play(
        code, 
        wpm, 
        frequency, 
        true,
        (state) => setActiveAudioState(state),
        () => setIsPlayingSound(false)
      );
      setIsPlayingSound(true);
    }
  };

  // --- Stop Current Playback ---
  const stopPlayback = () => {
    audioEngine.current.stop();
    setIsPlayingSound(false);
    setActiveAudioState({
      activeWordIndex: -1,
      activeLetterIndex: -1,
      activeSymbolIndex: -1,
      charPlaying: "",
      symbolPlaying: 'none'
    });
  };

  // --- Campaign Mode Logic ---
  const selectLevel = (level: CampaignLevel) => {
    // Stop any ongoing sounds
    stopPlayback();

    // Prepare random questions from level's questions pool (always 5 rounds)
    const shuffled = [...level.questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);

    setActiveLevel(level);
    setCampaignRound(0);
    setCampaignQuestions(selected);
    setCampaignAnswers([]);
    setCampaignScores([]);
    setUserCampaignInput("");
    setCampaignChecked(false);
    setCampaignAttempts(1);
    setCampaignCorrect(null);
    setShowLevelSummary(false);

    // Play the first question after selected state is configured
    setTimeout(() => {
      playCampaignQuestion(selected[0]);
    }, 400);
  };

  const playCampaignQuestion = (qText: string) => {
    setPlaybackText(qText);
    setIsPlayingSound(true);
    audioEngine.current.play(
      qText,
      wpm,
      frequency,
      false,
      (state) => setActiveAudioState(state),
      () => setIsPlayingSound(false)
    );
  };

  const verifyCampaignAnswer = () => {
    if (campaignChecked || !activeLevel) return;

    const currentCorrectAnswer = campaignQuestions[campaignRound].toUpperCase().trim();
    const cleanUserInput = userCampaignInput.toUpperCase().trim();
    const isCorrect = cleanUserInput === currentCorrectAnswer;

    setCampaignChecked(true);
    setCampaignCorrect(isCorrect);

    if (isCorrect) {
      // Calculate score for this round based on attempts
      let roundScore = 100;
      if (campaignAttempts === 2) roundScore = 60;
      else if (campaignAttempts === 3) roundScore = 30;
      else if (campaignAttempts > 3) roundScore = 10;

      const newScores = [...campaignScores, roundScore];
      setCampaignScores(newScores);
      setCampaignAnswers([...campaignAnswers, cleanUserInput]);

      // Sound feedback (High Pitch clean dot dot)
      const successKeyer = new MorseManualKeyer();
      successKeyer.startBeep(900);
      setTimeout(() => {
        successKeyer.stopBeep();
        setTimeout(() => {
          successKeyer.startBeep(900);
          setTimeout(() => successKeyer.stopBeep(), 60);
        }, 60);
      }, 60);

      // Save overall stats
      setOverallStats(prev => ({
        ...prev,
        totalCorrect: prev.totalCorrect + 1,
        totalRoundsPlayed: prev.totalRoundsPlayed + 1
      }));
    } else {
      // Try again or allow submit incorrect
      setCampaignAttempts(prev => prev + 1);
      
      // Error feedback (Low buzz)
      const errorKeyer = new MorseManualKeyer();
      errorKeyer.startBeep(250);
      setTimeout(() => {
        errorKeyer.stopBeep();
      }, 300);
    }
  };

  const skipOrAcceptWrong = () => {
    if (!activeLevel) return;
    // User wants to reveal or accept that they failed this question
    const cleanUserInput = userCampaignInput.toUpperCase().trim();
    setCampaignChecked(true);
    setCampaignCorrect(false);
    
    const newScores = [...campaignScores, 0];
    setCampaignScores(newScores);
    setCampaignAnswers([...campaignAnswers, cleanUserInput || "[เว้นว่าง]"]);

    setOverallStats(prev => ({
      ...prev,
      totalRoundsPlayed: prev.totalRoundsPlayed + 1
    }));
  };

  const nextCampaignRound = () => {
    if (!activeLevel) return;

    if (campaignRound < 4) {
      const nextRoundIndex = campaignRound + 1;
      setCampaignRound(nextRoundIndex);
      setUserCampaignInput("");
      setCampaignChecked(false);
      setCampaignAttempts(1);
      setCampaignCorrect(null);

      // Play next question sound
      setTimeout(() => {
        playCampaignQuestion(campaignQuestions[nextRoundIndex]);
      }, 400);
    } else {
      // End of level
      calculateLevelResult();
    }
  };

  const calculateLevelResult = () => {
    if (!activeLevel) return;

    const totalScore = campaignScores.reduce((acc, curr) => acc + curr, 0);
    const maxPossible = 500;
    const passed = totalScore >= 350; // Pass at 350+ out of 500 points

    // Calculate stars
    let starsAwarded = 0;
    if (totalScore === maxPossible) {
      starsAwarded = 3;
      triggerAchievementUnlock('perfect_score');
    } else if (totalScore >= 420) {
      starsAwarded = 2;
    } else if (totalScore >= 350) {
      starsAwarded = 1;
    }

    // Save Score
    const previousHighScore = highScores[activeLevel.id] || 0;
    if (totalScore > previousHighScore) {
      setHighScores(prev => ({
        ...prev,
        [activeLevel.id]: totalScore
      }));
    }

    const previousStars = levelStars[activeLevel.id] || 0;
    if (starsAwarded > previousStars) {
      setLevelStars(prev => ({
        ...prev,
        [activeLevel.id]: starsAwarded
      }));
    }

    // Unlock Next Level
    if (passed && activeLevel.id === unlockedLevel && unlockedLevel < 10) {
      setUnlockedLevel(prev => prev + 1);
    }

    if (passed && activeLevel.id === 10) {
      triggerAchievementUnlock('spu_ham');
    }

    setShowLevelSummary(true);

    // Play Victory CW Tune "73" (--...   ...--) or general melody
    setTimeout(() => {
      const vicKeyer = new MorseManualKeyer();
      // Melodic victory beeps
      const notes = [659, 659, 0, 659, 0, 523, 659, 0, 784];
      const durations = [100, 100, 50, 100, 50, 100, 100, 50, 150];
      let delay = 0;
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          if (freq > 0) vicKeyer.startBeep(freq);
          setTimeout(() => {
            vicKeyer.stopBeep();
          }, durations[idx]);
        }, delay);
        delay += durations[idx] + 40;
      });
    }, 400);
  };

  const restartCurrentLevel = () => {
    if (activeLevel) {
      selectLevel(activeLevel);
    }
  };

  // --- Custom Practice Mode Logic ---
  const generateCustomQuestion = () => {
    stopPlayback();

    let charsToUse: string[] = [];
    if (customCategory === 'letters') {
      charsToUse = Object.keys(MORSE_ALPHABET);
    } else if (customCategory === 'numbers') {
      charsToUse = Object.keys(MORSE_NUMBERS);
    } else if (customCategory === 'mixed') {
      charsToUse = [...Object.keys(MORSE_ALPHABET), ...Object.keys(MORSE_NUMBERS)];
    } else {
      // Abbreviations
      const keys = Object.keys(HAM_ABBREVIATIONS);
      const chosen = keys[Math.floor(Math.random() * keys.length)];
      setCustomQuestion(chosen);
      setUserCustomInput("");
      setCustomChecked(false);
      setCustomAttempts(1);
      setCustomCorrect(null);
      setTimeout(() => {
        playCustomQuestion(chosen);
      }, 200);
      return;
    }

    let result = "";
    for (let i = 0; i < customLength; i++) {
      const idx = Math.floor(Math.random() * charsToUse.length);
      result += charsToUse[idx];
    }

    setCustomQuestion(result);
    setUserCustomInput("");
    setCustomChecked(false);
    setCustomAttempts(1);
    setCustomCorrect(null);

    setTimeout(() => {
      playCustomQuestion(result);
    }, 200);
  };

  const playCustomQuestion = (text: string) => {
    setPlaybackText(text);
    setIsPlayingSound(true);
    audioEngine.current.play(
      text,
      wpm,
      frequency,
      false,
      (state) => setActiveAudioState(state),
      () => setIsPlayingSound(false)
    );
  };

  const verifyCustomAnswer = () => {
    if (customChecked) return;

    const answer = customQuestion.toUpperCase().trim();
    const userAns = userCustomInput.toUpperCase().trim();
    const isCorrect = userAns === answer;

    setCustomChecked(true);
    setCustomCorrect(isCorrect);

    if (isCorrect) {
      const newStreak = customStreak + 1;
      setCustomStreak(newStreak);
      if (newStreak > maxCustomStreak) {
        setMaxCustomStreak(newStreak);
      }

      // Success tone
      const sKeyer = new MorseManualKeyer();
      sKeyer.startBeep(880);
      setTimeout(() => {
        sKeyer.stopBeep();
        setTimeout(() => {
          sKeyer.startBeep(880);
          setTimeout(() => sKeyer.stopBeep(), 60);
        }, 60);
      }, 60);

      // Increment stats
      setOverallStats(prev => ({
        ...prev,
        totalCorrect: prev.totalCorrect + 1,
        totalRoundsPlayed: prev.totalRoundsPlayed + 1
      }));
    } else {
      setCustomStreak(0);
      setCustomAttempts(prev => prev + 1);

      // Error buzz
      const eKeyer = new MorseManualKeyer();
      eKeyer.startBeep(240);
      setTimeout(() => {
        eKeyer.stopBeep();
      }, 300);
    }
  };

  // --- Background Noise (QRM) Generator ---
  const startQRM = (level: number) => {
    stopQRM();
    if (localStorage.getItem('morse_audio_muted') === 'true') {
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700; 
      filter.Q.value = 1.2;
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = level === 2 ? 0.05 : 0.12;
      
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noise.start();
      noiseSourceRef.current = noise;
      noiseGainRef.current = gainNode;

      if (level === 3) {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 600; 
        gain1.gain.value = 0.02;
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        staticBeep1Ref.current = osc1;

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 800; 
        gain2.gain.value = 0.015;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        staticBeep2Ref.current = osc2;
      }
    } catch (e) {
      console.error("Failed to play QRM noise", e);
    }
  };

  const stopQRM = () => {
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch(e){}
      noiseSourceRef.current = null;
    }
    if (noiseGainRef.current) {
      try { noiseGainRef.current.disconnect(); } catch(e){}
      noiseGainRef.current = null;
    }
    if (staticBeep1Ref.current) {
      try { staticBeep1Ref.current.stop(); } catch(e){}
      staticBeep1Ref.current = null;
    }
    if (staticBeep2Ref.current) {
      try { staticBeep2Ref.current.stop(); } catch(e){}
      staticBeep2Ref.current = null;
    }
  };

  const startDrillTimer = () => {
    if (drillTimerIntervalRef.current) {
      clearInterval(drillTimerIntervalRef.current);
    }
    setDrillTimer(30);
    drillTimerIntervalRef.current = window.setInterval(() => {
      setDrillTimer(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (drillTimerIntervalRef.current) {
            clearInterval(drillTimerIntervalRef.current);
            drillTimerIntervalRef.current = null;
          }
          handleDrillTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as any;
  };

  const stopDrillTimer = () => {
    if (drillTimerIntervalRef.current) {
      clearInterval(drillTimerIntervalRef.current);
      drillTimerIntervalRef.current = null;
    }
    setDrillTimer(null);
  };

  const handleDrillTimeout = () => {
    setDrillChecked(true);
    setDrillStreak(0);
    stopQRM();
    
    const eKeyer = new MorseManualKeyer();
    eKeyer.startBeep(240);
    setTimeout(() => {
      eKeyer.stopBeep();
    }, 400);

    setOverallStats(prev => ({
      ...prev,
      totalRoundsPlayed: prev.totalRoundsPlayed + 1
    }));

    const newHistoryItem = {
      target: drillTarget,
      input: userDrillInput || "[หมดเวลา/TIMEOUT]",
      accuracy: 0,
      date: new Date().toLocaleTimeString()
    };
    setDrillHistory(prev => [newHistoryItem, ...prev].slice(0, 20));

    setShowToast({
      show: true,
      title: "⏰ หมดเวลา!",
      desc: "คุณไม่สามารถถอดรหัสได้ทันภายในเวลา 30 วินาที",
      icon: "⏰"
    });
    setTimeout(() => setShowToast(null), 3000);
  };

  // --- Randomized Decoding Drills Logic ---
  const playDrillQuestion = (text: string) => {
    setPlaybackText(text);
    setIsPlayingSound(true);
    stopQRM();

    const activeWpm = drillLevel === 1 ? 10 : drillLevel === 2 ? 15 : 20;

    if (drillLevel === 2) {
      startQRM(2);
    } else if (drillLevel === 3) {
      startQRM(3);
    }

    audioEngine.current.play(
      text,
      activeWpm,
      frequency,
      false,
      (state) => setActiveAudioState(state),
      () => {
        setIsPlayingSound(false);
      }
    );
  };

  const generateDrill = (forcedType?: 'letters' | 'numbers' | 'words' | 'ham' | 'mixed', forcedLevel?: 1 | 2 | 3) => {
    stopPlayback();
    stopQRM();
    stopDrillTimer();
    
    const activeLevel = forcedLevel !== undefined ? forcedLevel : drillLevel;
    const activeType = forcedType || drillType;
    let target = "";
    if (activeType === 'letters') {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let i = 0; i < 5; i++) {
        target += chars[Math.floor(Math.random() * chars.length)];
      }
    } else if (activeType === 'numbers') {
      const digits = "0123456789";
      for (let i = 0; i < 5; i++) {
        target += digits[Math.floor(Math.random() * digits.length)];
      }
    } else if (activeType === 'words') {
      target = COMMON_DRILL_WORDS[Math.floor(Math.random() * COMMON_DRILL_WORDS.length)];
    } else if (activeType === 'ham') {
      const hamKeys = Object.keys(HAM_ABBREVIATIONS);
      const w1 = hamKeys[Math.floor(Math.random() * hamKeys.length)];
      const w2 = hamKeys[Math.floor(Math.random() * hamKeys.length)];
      target = Math.random() > 0.4 ? `${w1} DE ${w2}` : w1;
    } else if (activeType === 'mixed') {
      const elements = [
        () => {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          let s = "";
          for (let i = 0; i < 3; i++) s += chars[Math.floor(Math.random() * chars.length)];
          return s;
        },
        () => {
          const digits = "0123456789";
          let s = "";
          for (let i = 0; i < 3; i++) s += digits[Math.floor(Math.random() * digits.length)];
          return s;
        },
        () => COMMON_DRILL_WORDS[Math.floor(Math.random() * COMMON_DRILL_WORDS.length)],
        () => {
          const hamKeys = Object.keys(HAM_ABBREVIATIONS);
          return hamKeys[Math.floor(Math.random() * hamKeys.length)];
        }
      ];
      const g1 = elements[Math.floor(Math.random() * elements.length)]();
      const g2 = elements[Math.floor(Math.random() * elements.length)]();
      target = `${g1} ${g2}`.toUpperCase();
    }

    setDrillTarget(target);
    setUserDrillInput("");
    setDrillChecked(false);
    setDrillAttempts(1);

    if (activeLevel === 3) {
      startDrillTimer();
    }

    if (autoPlayNext) {
      setTimeout(() => {
        playDrillQuestion(target);
      }, 300);
    }
  };

  const verifyDrillAnswer = () => {
    if (drillChecked) return;

    stopQRM();
    stopDrillTimer();

    const answer = drillTarget.toUpperCase().trim();
    const userAns = userDrillInput.toUpperCase().trim();
    
    const maxLen = Math.max(answer.length, userAns.length);
    if (maxLen === 0) return;

    let correctChars = 0;
    for (let i = 0; i < maxLen; i++) {
      if (answer[i] === userAns[i]) {
        correctChars++;
      }
    }
    const accuracyPercent = Math.round((correctChars / maxLen) * 100);
    const isPerfect = answer === userAns;

    setDrillChecked(true);

    if (isPerfect) {
      const newStreak = drillStreak + 1;
      setDrillStreak(newStreak);
      if (newStreak > maxDrillStreak) {
        setMaxDrillStreak(newStreak);
      }

      // Check if they successfully complete "FIRST STEP" (drillLevel === 1)
      if (drillLevel === 1) {
        setTimeout(() => {
          setShowCertModal(true);
        }, 1200);

        if (maxUnlockedDrillLevel < 2) {
          setMaxUnlockedDrillLevel(2);
          setShowToast({
            show: true,
            title: "🔓 ปลดล็อก LEVEL 2!",
            desc: "คุณได้ผ่านระดับแรกและปลดล็อกระดับ Apprentice แล้ว!",
            icon: "🔓"
          });
          setTimeout(() => setShowToast(null), 4000);
        }
      } else if (drillLevel === 2) {
        if (maxUnlockedDrillLevel < 3) {
          setMaxUnlockedDrillLevel(3);
          setShowToast({
            show: true,
            title: "🔓 ปลดล็อก LEVEL 3!",
            desc: "ยินดีด้วย! คุณผ่านระดับฝึกหัดและปลดล็อกระดับ Pro Ham แล้ว!",
            icon: "🔓"
          });
          setTimeout(() => setShowToast(null), 4000);
        }
      }

      if (autoIncreaseWpm && wpm < 40) {
        setWpm(prev => prev + 1);
        setShowToast({
          show: true,
          title: "⚡ ความเร็วเพิ่มขึ้น!",
          desc: `คุณถอดรหัสสมบูรณ์! ปรับเพิ่มความเร็วเป็น ${wpm + 1} WPM`,
          icon: "⚡"
        });
        setTimeout(() => setShowToast(null), 3000);
      }

      const sKeyer = new MorseManualKeyer();
      sKeyer.startBeep(880);
      setTimeout(() => {
        sKeyer.stopBeep();
        setTimeout(() => {
          sKeyer.startBeep(1100);
          setTimeout(() => sKeyer.stopBeep(), 80);
        }, 80);
      }, 80);

      setOverallStats(prev => ({
        ...prev,
        totalCorrect: prev.totalCorrect + 1,
        totalRoundsPlayed: prev.totalRoundsPlayed + 1
      }));
    } else {
      setDrillStreak(0);

      const eKeyer = new MorseManualKeyer();
      eKeyer.startBeep(240);
      setTimeout(() => {
        eKeyer.stopBeep();
      }, 300);

      setOverallStats(prev => ({
        ...prev,
        totalRoundsPlayed: prev.totalRoundsPlayed + 1
      }));
    }

    const newHistoryItem = {
      target: answer,
      input: userAns || "[เว้นว่าง]",
      accuracy: accuracyPercent,
      date: new Date().toLocaleTimeString()
    };
    setDrillHistory(prev => [newHistoryItem, ...prev].slice(0, 20));
  };

  const renderDrillComparison = () => {
    const targetChars = drillTarget.toUpperCase().split("");
    const inputChars = userDrillInput.toUpperCase().split("");
    const maxLen = Math.max(targetChars.length, inputChars.length);

    return (
      <div className="flex flex-col gap-3 font-mono mt-2">
        <div className="flex flex-col gap-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">โจทย์เป้าหมาย (TARGET):</div>
          <div className="flex flex-wrap gap-2 text-2xl font-bold tracking-widest text-slate-300">
            {targetChars.map((char, idx) => (
              <span key={idx} className="bg-slate-900 border border-slate-850 px-2.5 py-1 rounded">
                {char === " " ? "␣" : char}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">คำตอบของคุณ (YOUR ANSWER):</div>
          <div className="flex flex-wrap gap-2 text-2xl font-bold tracking-widest">
            {Array.from({ length: maxLen }).map((_, idx) => {
              const targetChar = targetChars[idx];
              const inputChar = inputChars[idx];
              const isMatch = targetChar === inputChar;

              return (
                <span 
                  key={idx} 
                  className={`px-2.5 py-1 rounded border transition-all ${
                    inputChar === undefined
                      ? 'bg-slate-900/40 border-dashed border-slate-800 text-slate-600'
                      : isMatch 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  }`}
                >
                  {inputChar === undefined ? "?" : (inputChar === " " ? "␣" : inputChar)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const handleClaimCertificate = () => {
    setCertError("");
    setCertSuccess("");

    const email = certEmail.trim();
    if (!email) {
      setCertError("* กรุณากรอกอีเมล");
      return;
    }

    // Email format + case-insensitive ending in @spumail.net validation
    const spuEmailRegex = /^[a-zA-Z0-9._%+-]+@spumail\.net$/i;
    if (!spuEmailRegex.test(email)) {
      setCertError("* กรุณาใช้อีเมล @spumail.net เท่านั้น");
      return;
    }

    setCertSuccess("🎉 ยืนยันสิทธิ์สำเร็จ! ระบบกำลังนำส่งประกาศนียบัตรไปยังกล่องจดหมายของคุณ");

    setTimeout(() => {
      setShowCertModal(false);
      setCertEmail("");
      setCertError("");
      setCertSuccess("");
    }, 3000);
  };
  const handleKeyerDown = () => {
    // Clear letter and word processing timers
    if (letterTimerRef.current) clearTimeout(letterTimerRef.current);
    if (wordTimerRef.current) clearTimeout(wordTimerRef.current);

    // Beep sound
    manualKeyer.current.startBeep(frequency);
    setIsKeyPressed(true);
    downTimeRef.current = performance.now();
  };

  const handleKeyerUp = () => {
    manualKeyer.current.stopBeep();
    setIsKeyPressed(false);
    upTimeRef.current = performance.now();

    const duration = upTimeRef.current - downTimeRef.current;
    if (duration <= 10) return; // Ignore accidental micro-clicks

    // Increment overall tap statistics
    setTotalTaps(prev => {
      const next = prev + 1;
      if (next >= 100) triggerAchievementUnlock('free_tapper');
      return next;
    });

    const unitDuration = 1200 / wpm; // length of 1 dot in ms
    // Standard threshold: a dot is 1 unit, a dash is 3 units.
    // Threshold is set around 1.8 units to leave leeway for human tapping.
    const isDot = duration < (unitDuration * 1.8);
    const newSymbol = isDot ? '.' : '-';

    setCurrentLetterBuffer(prev => prev + newSymbol);

    // Setup letter decoding timer (silence between letters is 3 units)
    // We wait 2.5 units to be highly responsive
    letterTimerRef.current = window.setTimeout(() => {
      setCurrentLetterBuffer(prevBuffer => {
        if (prevBuffer) {
          const decodedChar = morseToText(prevBuffer);
          setDecodedText(prevText => {
            const nextText = prevText + decodedChar;
            // Challenge completed achievements
            if (nextText.replace(/\s+/g, "").length >= 10) {
              triggerAchievementUnlock('free_tapper');
            }
            return nextText;
          });
          setDecodedMorse(prevMorse => prevMorse + (prevMorse ? " " : "") + prevBuffer);
        }
        return "";
      });

      // Setup word decoding timer (silence between words is 7 units)
      // We wait additional 3.5 units
      wordTimerRef.current = window.setTimeout(() => {
        setDecodedText(prevText => {
          if (prevText && !prevText.endsWith(' ')) {
            return prevText + ' ';
          }
          return prevText;
        });
        setDecodedMorse(prevMorse => {
          if (prevMorse && !prevMorse.endsWith('   ')) {
            return prevMorse + '   ';
          }
          return prevMorse;
        });
      }, unitDuration * 3.5);
    }, unitDuration * 2.5);
  };

  // Listen to physical Spacebar presses in the keyer tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if spacebar is pressed, keyer tab is active, and NOT typing in input elements
      if (e.code === 'Space' && isTappingTabFocused) {
        const activeElem = document.activeElement;
        const isInput = activeElem && (
          activeElem.tagName === 'INPUT' || 
          activeElem.tagName === 'TEXTAREA' || 
          activeElem.getAttribute('contenteditable') === 'true'
        );
        if (!isInput) {
          e.preventDefault(); // Stop webpage scrolling
          if (!isKeyPressed) {
            handleKeyerDown();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isTappingTabFocused) {
        if (isKeyPressed) {
          handleKeyerUp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isTappingTabFocused, isKeyPressed, wpm, frequency]);

  const clearDecoded = () => {
    setDecodedText("");
    setDecodedMorse("");
    setCurrentLetterBuffer("");
    if (letterTimerRef.current) clearTimeout(letterTimerRef.current);
    if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
  };

  // Play custom generated text from Free Tapping text area
  const playGeneratedMorse = () => {
    if (!textGeneratorInput.trim()) return;
    stopPlayback();
    setPlaybackText(textGeneratorInput.toUpperCase());
    setIsPlayingSound(true);
    audioEngine.current.play(
      textGeneratorInput.toUpperCase(),
      wpm,
      frequency,
      false,
      (state) => setActiveAudioState(state),
      () => setIsPlayingSound(false)
    );
  };

  const saveGeneratedMessage = () => {
    const msg = textGeneratorInput.toUpperCase().trim();
    if (msg && !savedMessages.includes(msg)) {
      const updated = [msg, ...savedMessages];
      setSavedMessages(updated);
      
      setShowToast({
        show: true,
        title: "💾 บันทึกสำเร็จ",
        desc: `บันทึกข้อความ "${msg.substring(0, 15)}${msg.length > 15 ? '...' : ''}" ไว้ในประวัติแล้ว`,
        icon: "📝"
      });
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const deleteSavedMessage = (index: number) => {
    const updated = savedMessages.filter((_, idx) => idx !== index);
    setSavedMessages(updated);
  };

  const loadSavedMessage = (msg: string) => {
    setTextGeneratorInput(msg);
    // Auto play it
    setTimeout(() => {
      stopPlayback();
      setPlaybackText(msg);
      setIsPlayingSound(true);
      audioEngine.current.play(
        msg,
        wpm,
        frequency,
        false,
        (state) => setActiveAudioState(state),
        () => setIsPlayingSound(false)
      );
    }, 100);
  };

  // Toggle theme helper
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Filter reference guide keys
  const filteredAlphabet = Object.keys(MORSE_ALPHABET).filter(char => 
    char.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
    MORSE_ALPHABET[char].includes(sidebarSearch)
  );

  const filteredNumbers = Object.keys(MORSE_NUMBERS).filter(char => 
    char.includes(sidebarSearch) || 
    MORSE_NUMBERS[char].includes(sidebarSearch)
  );

  const filteredHamAbbr = Object.keys(HAM_ABBREVIATIONS).filter(abbr => 
    abbr.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
    HAM_ABBREVIATIONS[abbr].definition.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
    HAM_ABBREVIATIONS[abbr].thaiDefinition.includes(sidebarSearch)
  );

  // Sound active beacon indicator color
  const isBeeping = activeAudioState.symbolPlaying === 'dot' || activeAudioState.symbolPlaying === 'dash' || isKeyPressed;

   // --- Immersive Gaming Auth Form Helpers ---
  const triggerAnimatedSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setAuthSubmittingStatus("INITIALIZING CYBER TERMINAL...");
    await new Promise(r => setTimeout(r, 450));
    setAuthSubmittingStatus("DECODING TRANSMISSION KEY...");
    await new Promise(r => setTimeout(r, 400));
    setAuthSubmittingStatus("ESTABLISHING SECURE HAM NET LINK...");
    await new Promise(r => setTimeout(r, 350));
    setIsAuthSubmitting(false);
    handleSignIn(e);
  };

  const triggerAnimatedSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setIsAuthSubmitting(true);
    setAuthSubmittingStatus("SCANNING SPU SPECTRUM BAND...");
    await new Promise(r => setTimeout(r, 450));
    setAuthSubmittingStatus("ASSIGNING CYBER TELEMETRY DB...");
    await new Promise(r => setTimeout(r, 400));
    setAuthSubmittingStatus("VERIFYING HAM CALLSIGN PROTOCOLS...");
    await new Promise(r => setTimeout(r, 350));
    setIsAuthSubmitting(false);
    handleSignUp(e);
  };

  // --- Landing page parallax movement state ---
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const x = (clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const y = (clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    setMousePos({ x, y });
  };

  if (!currentUser) {
    return (
      <div 
        id="app_root" 
        onMouseMove={handleMouseMove}
        className="min-h-screen font-sans flex flex-col bg-[#070B17] text-slate-100 relative overflow-x-hidden select-none pb-12 lg:pb-0"
      >
        
        {/* --- DYNAMIC & INTERACTIVE CYBER BACKGROUND --- */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[#070B17]">
          {/* Tech Map Dots */}
          <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(#7b5cff_1.5px,transparent_1.5px)] [background-size:20px_20px] pointer-events-none" />
          
          {/* Neon Radial Glow Gradients */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#7B5CFF]/15 to-transparent blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#FF4FD8]/10 to-transparent blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-r from-[#00D4FF]/5 to-transparent blur-[150px]" />

          {/* Grid Lines */}
          <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:40px_40px]" />

          {/* SPU Signal Waves emitting from the center */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
            <motion.circle
              cx="25%" cy="40%" r="40"
              stroke="#7B5CFF" strokeWidth="2" fill="none"
              animate={{ r: [40, 480], opacity: [0.9, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            />
            <motion.circle
              cx="25%" cy="40%" r="40"
              stroke="#00D4FF" strokeWidth="1.5" fill="none"
              animate={{ r: [40, 480], opacity: [0.9, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: 2.3 }}
            />
            <motion.circle
              cx="25%" cy="40%" r="40"
              stroke="#FF4FD8" strokeWidth="1" fill="none"
              animate={{ r: [40, 480], opacity: [0.9, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: 4.6 }}
            />
          </svg>

          {/* Dot World Map & Signal Lines */}
          <div className="absolute inset-0 opacity-[0.25] pointer-events-none flex items-center justify-center">
            <svg className="w-[120%] h-[120%] -translate-x-[10%] -translate-y-[5%]" viewBox="0 0 1000 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Connectors */}
              <motion.path
                d="M 280,240 Q 520,120 780,280"
                stroke="#7B5CFF" strokeWidth="1.5" strokeDasharray="6, 6" strokeLinecap="round" fill="none"
                animate={{ strokeDashoffset: [0, -40] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 4 }}
              />
              <motion.path
                d="M 280,240 Q 420,380 620,440"
                stroke="#00D4FF" strokeWidth="1" strokeDasharray="4, 4" strokeLinecap="round" fill="none"
                animate={{ strokeDashoffset: [0, 30] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 3 }}
              />
              <motion.path
                d="M 780,280 Q 700,380 620,440"
                stroke="#FF4FD8" strokeWidth="1.2" strokeDasharray="5, 5" strokeLinecap="round" fill="none"
                animate={{ strokeDashoffset: [0, -25] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 3.5 }}
              />

              {/* Pulsing Bangkok SPU Terminal Node */}
              <circle cx="280" cy="240" r="5" fill="#FF4FD8" />
              <motion.circle cx="280" cy="240" r="14" stroke="#FF4FD8" strokeWidth="1.5" fill="none" animate={{ r: [5, 28], opacity: [1, 0] }} transition={{ duration: 2.2, repeat: Infinity }} />
              
              {/* Pulsing Tokyo Node */}
              <circle cx="780" cy="280" r="4" fill="#00D4FF" />
              <motion.circle cx="780" cy="280" r="12" stroke="#00D4FF" strokeWidth="1.2" fill="none" animate={{ r: [4, 24], opacity: [1, 0] }} transition={{ duration: 1.9, repeat: Infinity }} />

              {/* Pulsing European Node */}
              <circle cx="620" cy="440" r="4" fill="#7B5CFF" />
              <motion.circle cx="620" cy="440" r="12" stroke="#7B5CFF" strokeWidth="1.2" fill="none" animate={{ r: [4, 24], opacity: [1, 0] }} transition={{ duration: 2.4, repeat: Infinity }} />

              {/* Floating Star Sparkles */}
              {[
                { cx: 150, cy: 110 }, { cx: 880, cy: 140 }, { cx: 450, cy: 370 }, { cx: 920, cy: 460 }, { cx: 90, cy: 420 }
              ].map((star, sIdx) => (
                <motion.path
                  key={sIdx}
                  d="M 0,-4 L 1,-1 L 4,0 L 1,1 L 0,4 L -1,1 L -4,0 L -1,-1 Z"
                  fill="#00D4FF"
                  transform={`translate(${star.cx}, ${star.cy})`}
                  animate={{ scale: [0.7, 1.3, 0.7], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2.5 + sIdx, ease: "easeInOut" }}
                />
              ))}
            </svg>
          </div>

          {/* Floating Morse Code Bits */}
          <div className="absolute inset-0 select-none">
            {[
              { text: "• • •  — — —  • • • (SOS)", top: "12%", left: "8%", delay: 0 },
              { text: "— • — •  — — • — (CQ)", top: "30%", left: "82%", delay: 2 },
              { text: "• —  — • •  — — (ADM)", top: "72%", left: "5%", delay: 4 },
              { text: "— — —  • • • — — (SK)", top: "84%", left: "58%", delay: 1 },
              { text: "• • —  • — •  — • (UR)", top: "48%", left: "32%", delay: 3 },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                className="absolute font-mono text-[10px] text-white/15 whitespace-nowrap tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/5 backdrop-blur-xs flex items-center gap-1.5"
                style={{ top: item.top, left: item.left }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.15, 0.5, 0.15],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 9,
                  repeat: Infinity,
                  delay: item.delay,
                  ease: "easeInOut",
                }}
              >
                <span className="text-[#00D4FF] animate-pulse">📡</span>
                {item.text}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Toast Notification Container */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#0a1024]/90 backdrop-blur-xl text-white px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(123,92,255,0.4)] font-display font-bold border border-[#7B5CFF]/30 max-w-md w-full mx-4"
              id="login-toast"
            >
              <div className="text-3xl bg-[#7B5CFF]/20 w-12 h-12 rounded-lg flex items-center justify-center border border-[#7B5CFF]/40">{showToast.icon}</div>
              <div className="flex-1">
                <h4 className="text-sm font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-[#00D4FF]">{showToast.title}</h4>
                <p className="text-xs font-sans font-medium text-slate-300 mt-0.5">{showToast.desc}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- GRID LAYOUT COMPLIANT WITH SCREEN PROPORTIONS (20% - 45% - 35%) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 max-w-[1920px] mx-auto w-full items-start p-4 lg:p-8 relative z-10 lg:h-screen lg:overflow-hidden">
          
          {/* --- COLUMN 1: LEFT SIDEBAR (20% Width) --- */}
          <motion.div 
            style={{ transform: `translate(${mousePos.x * 6}px, ${mousePos.y * 6}px)`, transition: 'transform 0.15s ease-out' }}
            className="lg:col-span-3 xl:col-span-2.5 flex flex-col justify-between h-full space-y-6 overflow-y-auto scrollbar-none pr-1"
          >
            {/* Header & Logo Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center p-3 bg-gradient-to-br from-[#7B5CFF]/20 to-[#00D4FF]/20 rounded-xl border border-[#7B5CFF]/30 shadow-lg group">
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-[#7B5CFF] to-[#00D4FF] rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xs"
                  />
                  <Trophy className="w-6 h-6 text-[#00D4FF] group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#7B5CFF] tracking-widest block leading-none">SRIPATUM AMATEUR RADIO</span>
                  <span className="text-base font-black uppercase text-white tracking-wider font-display">SPU HAM CLUB</span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h1 className="text-2xl font-black font-display tracking-tight text-white uppercase leading-tight">
                  SPU HAM<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] via-[#FF4FD8] to-[#00D4FF] drop-shadow-[0_0_15px_rgba(123,92,255,0.25)]">
                    TERMINAL
                  </span>
                </h1>
                <p className="text-slate-400 text-xs leading-relaxed font-sans">
                  เรียนรู้รหัสมอร์สผ่านภารกิจจำลองสุดท้าทาย ฝึกฝนการรับ-ส่งสัญญาณแบบเรียลไทม์ และชิงรางวัลเกียรติบัตรวิทยุมอร์สจากมหาวิทยาลัยศรีปทุม!
                </p>
              </div>
            </div>

            {/* Mascot Widget with Chat Bubble */}
            <motion.div 
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="bg-gradient-to-r from-[#0d1428]/80 to-[#101830]/80 border border-[#7B5CFF]/20 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0 select-none">
                  <svg className="w-16 h-16 drop-shadow-[0_0_10px_rgba(123,92,255,0.2)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 86C22 73 32 66 50 66C68 66 78 73 78 86V96H22V86Z" fill="url(#mascotJacketGrad)" />
                    <path d="M40 66L50 74L60 66" stroke="#FF4FD8" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M28 45C28 29 38 18 50 18C62 18 72 29 72 45V58H28V45Z" fill="#FF4FD8" />
                    <path d="M34 45C34 36 40 32 50 32C60 32 66 36 66 45C66 54 60 59 50 59C40 59 34 54 34 45Z" fill="#FEE2E2" />
                    <path d="M32 40C36 34 43 33 46 37C50 33 57 34 61 40C63 35 67 34 68 38" stroke="#FF4FD8" strokeWidth="5" strokeLinecap="round" />
                    <path d="M33 36C33 24 38 21 50 21C62 21 67 24 67 36" stroke="#00D4FF" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <rect x="27" y="38" width="6" height="14" rx="3" fill="#070B17" stroke="#00D4FF" strokeWidth="2.5" />
                    <rect x="67" y="38" width="6" height="14" rx="3" fill="#070B17" stroke="#00D4FF" strokeWidth="2.5" />
                    <motion.g
                      animate={{ scaleY: [1, 1, 0, 1, 1] }}
                      transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.9, 0.93, 0.96, 1] }}
                      style={{ originX: "50px", originY: "46px" }}
                    >
                      <circle cx="41.5" cy="47" r="1.5" fill="#0F172A" />
                      <circle cx="58.5" cy="47" r="1.5" fill="#0F172A" />
                    </motion.g>
                    <path d="M48 52C49 53 51 53 52 52" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    <defs>
                      <linearGradient id="mascotJacketGrad" x1="50" y1="66" x2="50" y2="96" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#7B5CFF" />
                        <stop offset="100%" stopColor="#FF4FD8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D4FF]"></span>
                  </span>
                </div>
                <div>
                  <span className="text-[8px] font-mono bg-[#7B5CFF]/20 border border-[#7B5CFF]/30 rounded-md px-1.5 py-0.5 text-[#00D4FF] font-bold uppercase block w-max mb-1">
                    LIVE ASSISTANT
                  </span>
                  <div className="bg-[#070b17]/90 border border-white/10 rounded-xl p-2.5 shadow-inner text-[10px] text-slate-300 font-medium leading-relaxed max-w-[150px]">
                    ยินดีต้อนรับเข้าสู่สถานีวิทยุมอร์สจำลอง SPU HAM ค่ะ! 73!
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Radio / Spectrum Telegraph Animation */}
            <div className="space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider block">
                📟 Radio Spectrum Spectrogram
              </span>
              <div className="flex items-end gap-1.5 h-12 w-full justify-center bg-[#050917] border border-white/5 rounded-xl p-3">
                {[...Array(14)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-[#7B5CFF] via-[#FF4FD8] to-[#00D4FF]"
                    animate={{
                      height: ["15%", `${25 + Math.random() * 75}%`, "15%"]
                    }}
                    transition={{
                      duration: 0.7 + Math.random() * 0.7,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.04
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                <span>FREQ: 144.400 MHz</span>
                <span>MODE: CW (TELEGRAPHY)</span>
              </div>
            </div>

            {/* Quick System Links Footer */}
            <div className="border-t border-white/5 pt-4 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>STN STATUS:</span>
                <span className="text-[#00FFA3] flex items-center gap-1 font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FFA3]" />
                  ONLINE
                </span>
              </div>
              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="w-full text-[10px] font-mono font-bold text-slate-400 hover:text-[#00D4FF] bg-white/5 border border-white/10 rounded-xl py-2 backdrop-blur-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:border-[#00D4FF]/30 hover:scale-102"
              >
                {theme === 'dark' ? '☀️ LIGHT STATION' : '🌙 CYBER SYSTEM'}
              </button>
            </div>
          </motion.div>

          {/* --- COLUMN 2: CENTER PIECE (45% Width) --- */}
          <div className="lg:col-span-5 xl:col-span-5.5 flex flex-col items-center justify-center h-full py-4 overflow-y-auto scrollbar-none">
            
            <motion.div 
              style={{ transform: `translate(${mousePos.x * -4}px, ${mousePos.y * -4}px)`, transition: 'transform 0.15s ease-out' }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="w-full max-w-[560px] bg-[#0a0f24]/75 backdrop-blur-2xl rounded-[24px] border border-white/10 p-10 shadow-[0_0_50px_rgba(123,92,255,0.18)] relative overflow-hidden flex flex-col justify-between"
            >
              {/* Top glowing line accent */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#7B5CFF] via-[#FF4FD8] to-[#00D4FF] shadow-[0_3px_20px_rgba(0,212,255,0.5)]" />
              
              {/* Embedded scanlines in login card for a subtle cyberpunk vibe */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-20" />

              {/* --- SPINNING SCANNER LOADER (Riot style) --- */}
              <AnimatePresence>
                {isAuthSubmitting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#070b17]/95 z-40 flex flex-col items-center justify-center p-6 text-center"
                  >
                    <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                      <motion.div 
                        className="absolute inset-0 rounded-full border-2 border-t-[#7B5CFF] border-r-transparent border-b-[#00D4FF] border-l-transparent"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.div 
                        className="absolute inset-2 rounded-full border-2 border-t-transparent border-r-[#FF4FD8] border-b-transparent border-l-[#00FFA3]"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      <Trophy className="w-7 h-7 text-[#00D4FF] animate-pulse" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-sm font-display font-black tracking-widest text-white uppercase animate-bounce">
                        {authSubmittingStatus}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-400">
                        SRIPATUM RADIO SECURE DECODER KEY EXCHANGE...
                      </p>
                    </div>
                    
                    <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-6 relative">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-[#7B5CFF] to-[#00D4FF] w-24 rounded-full"
                        animate={{ x: [-100, 200] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-6">
                {/* Form Title Header */}
                <div className="text-center">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#FF4FD8] bg-[#FF4FD8]/10 border border-[#FF4FD8]/20 px-2.5 py-1 rounded-full inline-block mb-3">
                    SECURITY GATEWAY CONNECT
                  </span>
                  <h2 className="text-2xl font-display font-black uppercase text-white tracking-wide">
                    {authMode === 'signin' ? "ACCESS GATE LINK" : "NEW REGISTRATION"}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    {authMode === 'signin' ? "กรอกกุญแจข้อมูลเพื่อปลดล็อกเข้าสู่แอปพลิเคชัน" : "ลงทะเบียนบัญชีสมาชิกวิทยุมอร์ส SPU"}
                  </p>
                </div>

                {/* Toggle Tabs (Riot Style - larger padding) */}
                <div className="grid grid-cols-2 bg-[#060a1a] rounded-xl p-1.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setAuthError(""); setAuthSuccess(""); }}
                    className={`py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                      authMode === 'signin' 
                        ? 'bg-gradient-to-r from-[#7B5CFF] to-[#FF4FD8] text-white shadow-lg font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>SIGN IN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(""); setAuthSuccess(""); }}
                    className={`py-3.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                      authMode === 'signup' 
                        ? 'bg-gradient-to-r from-[#FF4FD8] to-[#00D4FF] text-white shadow-lg font-black' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>SIGN UP</span>
                  </button>
                </div>

                {/* Authentication Errors */}
                {authError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-400 font-medium flex items-center gap-2.5 shadow-sm"
                  >
                    <XCircle className="w-5 h-5 shrink-0 text-rose-500 animate-pulse" />
                    <span className="leading-relaxed">{authError}</span>
                  </motion.div>
                )}

                {/* SIGN IN FORM WITH 54px INPUTS & 56px BUTTONS */}
                {authMode === 'signin' ? (
                  <form onSubmit={triggerAnimatedSignIn} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5">อีเมลผู้ใช้งาน (EMAIL ADDRESS)</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="student@spumail.net หรือ อีเมลทั่วไป"
                          className="w-full pl-12 pr-4 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#7B5CFF] focus:ring-1 focus:ring-[#7B5CFF] transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block">รหัสผ่านลับ (PASSWORD)</label>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-12 pr-12 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#7B5CFF] focus:ring-1 focus:ring-[#7B5CFF] transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => !prev)}
                          className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Admin Quick Login Option */}
                    <div className="flex justify-start items-center py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthEmail("kittapat.chi@spumail.net");
                          setAuthPassword("password123");
                          setShowToast({
                            show: true,
                            title: "🔑 กรอกข้อมูลแอดมินให้แล้ว",
                            desc: "ข้อมูลอีเมลและรหัสผ่านของแอดมินถูกกรอกแล้ว คลิกปุ่มเข้าสู่ระบบด้านล่างได้เลย!",
                            icon: "🛡️"
                          });
                          setTimeout(() => setShowToast(null), 4000);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all hover:translate-x-1 cursor-pointer bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg"
                      >
                        <Settings className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                        <span>ป้อนรหัสผ่านแอดมินอัตโนมัติ (Admin Quick Fill)</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-14 rounded-xl bg-gradient-to-r from-[#7B5CFF] via-[#a34ffd] to-[#FF4FD8] text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_25px_rgba(123,92,255,0.4)] hover:shadow-[0_4px_35px_rgba(123,92,255,0.6)] hover:scale-[1.01] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>ปลดล็อก & เชื่อมต่อสัญญาณ</span>
                    </button>
                  </form>
                ) : (
                  /* SIGN UP FORM WITH 54px INPUTS & 56px BUTTONS */
                  <form onSubmit={triggerAnimatedSignUp} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5">ชื่อแสดงผล (DISPLAY PROFILE NAME)</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="เช่น นายกิตติภัทร หรือ นามสมมุติ"
                          className="w-full pl-12 pr-4 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#FF4FD8] focus:ring-1 focus:ring-[#FF4FD8] transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5">อีเมลใช้งาน (EMAIL ADDRESS)</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="student@spumail.net หรือ gmail"
                          className="w-full pl-12 pr-4 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#FF4FD8] focus:ring-1 focus:ring-[#FF4FD8] transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5 flex justify-between">
                          <span>สัญญาณเรียกขาน</span>
                          <span className="text-[#00D4FF] font-medium text-[9px] normal-case">ไม่บังคับ</span>
                        </label>
                        <div className="relative">
                          <Activity className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type="text"
                            value={authCallsign}
                            onChange={(e) => setAuthCallsign(e.target.value)}
                            placeholder="เช่น HS0ABC"
                            className="w-full pl-12 pr-4 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#FF4FD8] focus:ring-1 focus:ring-[#FF4FD8] transition-all uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5">ตั้งรหัสผ่าน (PASSWORD)</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-4.5 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="6 ตัวขึ้นไป"
                            className="w-full pl-12 pr-10 h-14 text-sm rounded-xl bg-[#070b17]/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#FF4FD8] focus:ring-1 focus:ring-[#FF4FD8] transition-all"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-14 mt-2 rounded-xl bg-gradient-to-r from-[#FF4FD8] via-[#af4ffd] to-[#00D4FF] text-xs font-bold uppercase tracking-widest text-white shadow-[0_4px_25px_rgba(255,79,216,0.4)] hover:shadow-[0_4px_35px_rgba(255,79,216,0.6)] hover:scale-[1.01] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>ลงทะเบียนสร้างสถานีใหม่</span>
                    </button>
                  </form>
                )}

                {/* Divider Line */}
                <div className="relative my-4 flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="mx-3 flex-shrink text-[8px] uppercase tracking-widest text-slate-500 font-bold font-mono">
                    SECURE OAUTH GATE
                  </span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                {/* Google login matching Primary button dimensions */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full h-14 rounded-xl bg-[#0d1428] hover:bg-[#121c38] text-slate-200 font-bold text-xs flex items-center justify-center gap-3 border border-white/10 hover:border-[#7B5CFF]/40 transition-all cursor-pointer shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_20px_rgba(123,92,255,0.15)] group hover:scale-[1.01]"
                  >
                    <svg className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>ลงชื่อเข้าใช้งานด้วย SPU GOOGLE MAIL</span>
                  </button>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-[8px] font-mono text-slate-500 uppercase tracking-widest">
                <span>SYSTEM SECURE GATEWAY</span>
                <span className="text-[#00FFA3]">SPUMail.net Active</span>
              </div>
            </motion.div>
          </div>

          {/* --- COLUMN 3: RIGHT SIDEBAR (35% Width) --- */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-5 overflow-y-auto h-full scrollbar-none pb-12 lg:pb-0 pr-1">
            
            {/* Widget 1: Today's Mission (Width: 300-360px, Padding: 20px) */}
            <motion.div
              style={{ transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)`, transition: 'transform 0.2s ease-out' }}
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
              className="w-full max-w-[360px] p-5 bg-[#0c1226]/60 border border-white/10 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(123,92,255,0.25)] hover:border-[#7B5CFF]/40 duration-300 relative overflow-hidden backdrop-blur-xl space-y-3.5"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#FF4FD8] animate-pulse" />
                  <h3 className="text-xs font-display font-black text-white uppercase tracking-wider">Today's Mission</h3>
                </div>
                <span className="text-[10px] font-mono bg-[#FF4FD8]/10 text-[#FF4FD8] px-2 py-0.5 rounded-md font-bold">ACTIVE</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-200">ถอดรหัสข้อความจำลอง 10 ข้อความ</p>
                  <p className="text-[10px] font-mono text-[#00FFA3] flex items-center gap-1 font-bold">
                    <span>REWARD:</span>
                    <span className="bg-[#00FFA3]/10 px-1.5 py-0.5 rounded">+50 XP</span>
                  </p>
                </div>
                
                {/* Circular Gauge */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="transparent" />
                    <motion.circle
                      cx="20" cy="20" r="16"
                      stroke="#00D4FF"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray="100"
                      initial={{ strokeDashoffset: 100 }}
                      animate={{ strokeDashoffset: 25 }}
                      transition={{ duration: 2, ease: "easeOut" }}
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-mono font-bold text-[#00D4FF]">75%</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>ภารกิจรายวันคืบหน้า</span>
                  <span>7 / 10 DECODED</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#7B5CFF] to-[#00D4FF] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "70%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Widget 2: Leaderboard (Width: 300-360px, Padding: 20px) */}
            <motion.div
              style={{ transform: `translate(${mousePos.x * -6}px, ${mousePos.y * -6}px)`, transition: 'transform 0.2s ease-out' }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="w-full max-w-[360px] p-5 bg-[#0c1226]/60 border border-white/10 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(123,92,255,0.25)] hover:border-[#7B5CFF]/40 duration-300 relative overflow-hidden backdrop-blur-xl space-y-3"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#00D4FF] animate-pulse" />
                  <h3 className="text-xs font-display font-black text-white uppercase tracking-wider">Top SPU Operators</h3>
                </div>
                <span className="text-[9px] font-mono text-[#00D4FF] font-bold">REAL-TIME</span>
              </div>

              <div className="space-y-1.5">
                {[
                  { rank: "#1", name: "HS0ABC", xp: "9,800 XP", avatar: "👑", text: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                  { rank: "#2", name: "SPU001", xp: "8,450 XP", avatar: "🥈", text: "text-slate-300", bg: "bg-slate-300/10 border-slate-300/20" },
                  { rank: "#3", name: "CWMaster", xp: "7,900 XP", avatar: "🥉", text: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" }
                ].map((leader, lIdx) => (
                  <div 
                    key={lIdx}
                    className={`flex items-center justify-between p-1.5 rounded-lg border text-xs ${leader.bg}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-black ${leader.text} w-5 text-center`}>{leader.rank}</span>
                      <span className="text-base">{leader.avatar}</span>
                      <span className="font-bold text-slate-100">{leader.name}</span>
                    </div>
                    <span className="font-mono text-[9px] text-slate-400 font-bold">{leader.xp}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Widget 3: Operator Status & Multiplier */}
            <motion.div
              style={{ transform: `translate(${mousePos.x * 8}px, ${mousePos.y * 8}px)`, transition: 'transform 0.2s ease-out' }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="w-full max-w-[360px] p-5 bg-[#0c1226]/60 border border-white/10 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(123,92,255,0.25)] hover:border-[#7B5CFF]/40 duration-300 relative overflow-hidden backdrop-blur-xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs">⚡</span>
                  <h3 className="text-xs font-display font-black text-white uppercase tracking-wider">License Class</h3>
                </div>
                <span className="text-[9px] font-mono bg-[#00D4FF]/10 text-[#00D4FF] px-2 py-0.5 rounded-md font-bold">1.5X EXP BOOST</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Rank Class:</span>
                  <span className="font-mono text-transparent bg-clip-text bg-gradient-to-r from-[#7B5CFF] to-[#00D4FF] font-black">SPU NOVICE STATION</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">License Key:</span>
                  <span className="font-mono text-slate-300">CW-DEC-9943</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Telemetry sync:</span>
                  <span className="text-[#00FFA3] font-bold animate-pulse">STABLE (SECURE)</span>
                </div>
              </div>
            </motion.div>

            {/* Widget 4: Daily Bonus Reward */}
            <motion.div
              style={{ transform: `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px)`, transition: 'transform 0.2s ease-out' }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="w-full max-w-[360px] p-5 bg-[#0c1226]/60 border border-white/10 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(123,92,255,0.25)] hover:border-[#7B5CFF]/40 duration-300 relative overflow-hidden backdrop-blur-xl space-y-3"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🎁</span>
                  <h3 className="text-xs font-display font-black text-white uppercase tracking-wider">Daily Bonus Reward</h3>
                </div>
                <span className="text-[10px] font-mono text-[#00FFA3] font-bold">3 DAYS STREAK</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { day: "D1", xp: "+10", status: "claimed" },
                  { day: "D2", xp: "+20", status: "claimed" },
                  { day: "D3", xp: "+30", status: "claimed" },
                  { day: "D4", xp: "+50", status: "claimable" },
                  { day: "D5", xp: "+100", status: "locked" }
                ].map((reward, rIdx) => (
                  <div 
                    key={rIdx} 
                    className={`flex flex-col items-center justify-between p-1.5 rounded-xl border text-center h-14 transition-all ${
                      reward.status === "claimed" 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : reward.status === "claimable"
                        ? "bg-[#7B5CFF]/20 border-[#7B5CFF]/40 text-[#00D4FF] animate-pulse cursor-pointer hover:scale-105"
                        : "bg-white/5 border-white/5 text-slate-500"
                    }`}
                  >
                    <span className="text-[8px] font-mono font-bold leading-none">{reward.day}</span>
                    <span className="text-[9px] font-bold font-display leading-none">{reward.xp}</span>
                    <span className="text-[7px] font-mono uppercase tracking-tight leading-none">
                      {reward.status === "claimed" ? "✓" : reward.status === "claimable" ? "CLAIM" : "LOCK"}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Widget 5: Achievements Previews */}
            <motion.div
              style={{ transform: `translate(${mousePos.x * 5}px, ${mousePos.y * 5}px)`, transition: 'transform 0.2s ease-out' }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
              className="w-full max-w-[360px] p-5 bg-[#0c1226]/60 border border-white/10 rounded-2xl shadow-lg hover:shadow-[0_0_20px_rgba(123,92,255,0.25)] hover:border-[#7B5CFF]/40 duration-300 relative overflow-hidden backdrop-blur-xl space-y-3"
            >
              <h3 className="text-xs font-display font-black text-slate-400 uppercase tracking-widest block text-left">
                🏅 Unlockable Achievements
              </h3>
              
              <div className="space-y-2.5">
                {[
                  { title: "Beginner Operator", desc: "ถอดรหัสข้อความแรกสำเร็จ", rarity: "BRONZE", icon: "🥉", border: "border-amber-700/30", text: "text-amber-400", bg: "from-amber-950/20 to-transparent" },
                  { title: "Signal Hunter", desc: "ดักจับสัญญาณวิทยุครบ 50 ครั้ง", rarity: "SILVER", icon: "🥈", border: "border-slate-500/30", text: "text-slate-300", bg: "from-slate-900/30 to-transparent" },
                  { title: "Morse Master", desc: "สอบผ่านเกียรติบัตรวิทยุมอร์ส SPU", rarity: "GOLD", icon: "🥇", border: "border-purple-500/40", text: "text-[#00D4FF]", bg: "from-[#7B5CFF]/10 to-transparent" }
                ].map((ach, aIdx) => (
                  <div 
                    key={aIdx}
                    className={`bg-gradient-to-b ${ach.bg} border ${ach.border} rounded-xl p-2.5 flex items-start gap-2.5 relative group overflow-hidden`}
                  >
                    <div className="text-xl shrink-0 group-hover:scale-110 transition-transform duration-300">{ach.icon}</div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-white leading-none block">{ach.title}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight font-sans">{ach.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div id="app_root" className={`min-h-screen font-sans flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-[#121212] text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      
      {/* Achievement unlock toast popup */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gradient-to-r from-pink-500 to-blue-500 text-white px-6 py-4 rounded-xl shadow-2xl font-display font-bold border border-pink-300 max-w-md w-full mx-4"
            id="toast-achievement"
          >
            <div className="text-3xl">{showToast.icon}</div>
            <div className="flex-1">
              <div className="text-sm uppercase tracking-wide opacity-80">Achievement Unlocked!</div>
              <h4 className="text-lg leading-tight">{showToast.title}</h4>
              <p className="text-xs font-sans font-medium text-white/95 mt-0.5">{showToast.desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Certificate Claim Modal */}
      <AnimatePresence>
        {showCertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border-2 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.6)] rounded-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header/Banner */}
              <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-6 text-center relative">
                <button 
                  onClick={() => setShowCertModal(false)}
                  className="absolute top-4 right-4 text-white hover:text-pink-200 text-lg font-black cursor-pointer"
                >
                  ✕
                </button>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Award className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black font-display uppercase tracking-widest text-white leading-tight">
                  CONGRATULATIONS!
                </h3>
                <p className="text-xs text-pink-100 uppercase tracking-wider mt-1 font-mono">
                  LEVEL 1: FIRST STEP COMPLETED
                </p>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-4">
                <div className="text-center text-slate-300 text-sm">
                  <p>ยินดีด้วย! คุณผ่านด่านการถอดรหัสพื้นฐาน "FIRST STEP" อย่างแม่นยำ 100% สำเร็จแล้ว</p>
                  <p className="text-xs text-slate-400 mt-2">กรอกอีเมลของคุณเพื่อขอรับใบรับรองประกาศนียบัตรแบบดิจิทัลฟรีจากสโมสรวิทยุสมัครเล่น SPU</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">อีเมลของคุณ (@spumail.net เท่านั้น)</label>
                  <input
                    type="email"
                    placeholder="kittapat.chi@spumail.net"
                    value={certEmail}
                    onChange={(e) => {
                      setCertEmail(e.target.value);
                      setCertError("");
                    }}
                    className="w-full h-12 bg-black border border-slate-800 hover:border-slate-700 focus:border-pink-500 text-white rounded-xl px-4 text-center font-mono focus:outline-none transition-colors"
                  />
                  {certError && (
                    <p className="text-rose-500 text-xs font-semibold text-center animate-pulse mt-1">
                      {certError}
                    </p>
                  )}
                  {certSuccess && (
                    <p className="text-emerald-400 text-xs font-semibold text-center animate-pulse mt-1">
                      {certSuccess}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCertModal(false)}
                    className="flex-1 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-display rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    ปิด (Close)
                  </button>
                  <button
                    onClick={handleClaimCertificate}
                    disabled={!!certSuccess}
                    className="flex-1 h-12 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-800/50 disabled:text-pink-400 text-white font-black font-display rounded-xl text-xs uppercase tracking-widest transition-colors cursor-pointer shadow-md neon-glow-pink"
                  >
                    {certSuccess ? "ส่งสำเร็จ..." : "รับใบเซอร์ (CLAIM)"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Profile & Progress Modal */}
      <AnimatePresence>
        {showProfileModal && currentUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`border rounded-2xl w-full max-w-lg overflow-hidden my-8 shadow-2xl transition-colors duration-300 ${
                theme === 'dark' ? 'bg-[#0f172a] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white relative">
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-4 right-4 text-white hover:text-indigo-200 text-lg font-black cursor-pointer transition-colors"
                >
                  ✕
                </button>
                <div className="flex items-center gap-4">
                  <span className="text-4xl bg-white/20 p-3 rounded-full leading-none shadow-inner select-none">{editProfileAvatar}</span>
                  <div className="text-left">
                    <h3 className="text-xl font-black font-display uppercase tracking-wider">{currentUser.name}</h3>
                    <p className="text-xs text-indigo-100 font-mono mt-0.5 uppercase tracking-widest flex items-center gap-2 flex-wrap">
                      <span className="bg-white/10 px-2 py-0.5 rounded-md font-bold">{currentUser.email}</span>
                      {currentUser.callsign && (
                        <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-md font-bold">{currentUser.callsign}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-thin">
                
                {/* 1. Progress and Roadmap Overview */}
                <div className="space-y-3.5 text-left">
                  <h4 className="text-xs font-black text-pink-500 uppercase tracking-widest font-display flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    <span>ความก้าวหน้าและการพัฒนา (Your Training Roadmap)</span>
                  </h4>
                  
                  {/* Campaign Path */}
                  <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">โหมดด่านแคมเปญ (Campaign Mode)</span>
                      <span className="text-xs font-mono font-bold text-pink-500">ด่าน {unlockedLevel} / 10</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${(unlockedLevel / 10) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>LEVEL 1 (Basic)</span>
                      <span>LEVEL 5 (Intermediate)</span>
                      <span>LEVEL 10 (Pro)</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {unlockedLevel === 10 
                        ? "🏆 ยอดเยี่ยมมาก! คุณผ่านด่านทั้งหมดแล้ว ขอรับใบรับรองประกาศนียบัตรได้เลย" 
                        : `คุณกำลังอยู่ในด่านที่ ${unlockedLevel}. ผ่านด่านนี้เพื่อก้าวไปสู่ด่านถัดไป!`}
                    </p>
                  </div>

                  {/* Noise & Interference Path */}
                  <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">โหมดคลื่นรบกวน (Drills Mode)</span>
                      <span className="text-xs font-mono font-bold text-blue-400">ระดับสูงสุด: LEVEL {maxUnlockedDrillLevel} / 3</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold font-mono">
                      <div className={`py-1 rounded border ${maxUnlockedDrillLevel >= 1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-850 border-slate-700/30 text-slate-500'}`}>LV.1 LIGHT</div>
                      <div className={`py-1 rounded border ${maxUnlockedDrillLevel >= 2 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-850 border-slate-700/30 text-slate-500'}`}>LV.2 MEDIUM</div>
                      <div className={`py-1 rounded border ${maxUnlockedDrillLevel >= 3 ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-slate-850 border-slate-700/30 text-slate-500'}`}>LV.3 HEAVY</div>
                    </div>
                  </div>

                  {/* Cumulative Lifetime Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3.5 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-2xl font-black text-pink-500 font-mono">{overallStats.totalRoundsPlayed}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">จำนวนรอบที่เล่นทั้งหมด</div>
                    </div>
                    <div className={`p-3.5 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-2xl font-black text-blue-400 font-mono">
                        {overallStats.totalRoundsPlayed > 0 ? Math.round((overallStats.totalCorrect / overallStats.totalRoundsPlayed) * 100) : 0}%
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">อัตราความถูกต้องแม่นยำ</div>
                    </div>
                  </div>
                </div>

                {/* 2. Edit Profile Form */}
                <div className="space-y-4 pt-4 border-t border-slate-800/40 text-left">
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest font-display flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" />
                    <span>แก้ไขข้อมูลสมาชิกร้านมอร์ส (Edit Profile)</span>
                  </h4>

                  {/* Avatar Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">เลือกอวาตาร์ผู้ใช้งาน</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["👨‍🚀", "🛰️", "📡", "📻", "🎙️", "⚡", "🦉", "🦊", "🦁", "🐱"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setEditProfileAvatar(emoji)}
                          className={`w-10 h-10 text-xl rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                            editProfileAvatar === emoji 
                              ? 'bg-gradient-to-br from-pink-500 to-purple-600 border-pink-400 scale-110 shadow-lg text-white' 
                              : 'bg-slate-800 border-slate-700/60 text-slate-300 hover:bg-slate-750'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">ชื่อแสดงผล</label>
                      <input
                        type="text"
                        value={editProfileName}
                        onChange={(e) => setEditProfileName(e.target.value)}
                        className={`w-full text-sm rounded-lg border px-3.5 py-2 focus:border-pink-500 focus:outline-none transition-colors ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        placeholder="ชื่อ-นามสกุล หรือนามแฝง"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">สัญญาณเรียกขาน (Callsign)</label>
                      <input
                        type="text"
                        value={editProfileCallsign}
                        onChange={(e) => setEditProfileCallsign(e.target.value)}
                        className={`w-full text-sm rounded-lg border px-3.5 py-2 focus:border-pink-500 focus:outline-none transition-colors uppercase ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        placeholder="เช่น E25DUV, HS1AAA"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateProfile}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs uppercase tracking-wider transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกการเปลี่ยนแปลงโปรไฟล์</span>
                  </button>
                </div>

                {/* 3. Dangerous / Account Actions */}
                <div className="pt-4 border-t border-rose-500/20 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleResetUserProgress}
                    className="flex-1 py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ล้างสถิติ / เริ่มต้นใหม่</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออกจากระบบ (SIGN OUT)</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <header className="min-h-16 h-auto md:h-16 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-3 md:py-0 border-b-4 border-pink-500 shrink-0 sticky top-0 z-40 shadow-md gap-3 md:gap-4" id="header-main">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
          
          <div className="text-center sm:text-left">
            <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none text-white">MORSE CODE TRAINING</h1>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">Developed by Sripatum University Amateur Radio Club</p>
          </div>

          {/* Settings & Theme Control Bar */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            
            {/* Quick Stats Summary */}
            <div className="hidden xs:flex items-center gap-2.5 px-3 py-1 bg-slate-850 text-xs font-mono text-slate-300 border border-slate-700/40 rounded-full">
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-pink-500" />
                <span>ถูกต้อง: <b className="text-pink-500">{overallStats.totalCorrect}</b></span>
              </div>
              <div className="w-px h-3 bg-slate-700" />
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                <span>Lv.{unlockedLevel}/10</span>
              </div>
            </div>

            {/* Audio Stop Button (If playing) */}
            {isPlayingSound && (
              <button 
                onClick={stopPlayback}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                title="หยุดเสียง"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>STOP</span>
              </button>
            )}

            {/* Global Mute/Unmute Toggle */}
            <button
              id="global-mute-btn"
              onClick={toggleMute}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
                isAudioMuted 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' 
                  : 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-750'
              }`}
              title={isAudioMuted ? "เปิดเสียง (Unmute)" : "ปิดเสียง (Mute)"}
            >
              {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider">
                {isAudioMuted ? "MUTED" : "SOUND ON"}
              </span>
            </button>

            {/* Theme Toggle Capsule from design */}
            <div className="flex items-center bg-slate-800 rounded-full px-2.5 py-1 border border-slate-700">
              <span className="text-[10px] font-bold text-pink-500 mr-1.5 uppercase tracking-wider hidden md:inline">THEME:</span>
              <button 
                onClick={() => setTheme('light')}
                className={`w-4 h-4 rounded-full bg-slate-200 border transition-all cursor-pointer ${theme === 'light' ? 'border-pink-500 ring-2 ring-pink-400 scale-110' : 'border-white opacity-50 hover:opacity-100'}`}
                title="โหมดสว่าง"
              ></button>
              <button 
                onClick={() => setTheme('dark')}
                className={`w-4 h-4 rounded-full bg-slate-950 ml-1.5 border transition-all cursor-pointer ${theme === 'dark' ? 'border-blue-500 ring-2 ring-blue-400 scale-110' : 'border-slate-600 opacity-50 hover:opacity-100'}`}
                title="โหมดมืด"
              ></button>
            </div>



            {/* User Profile Capsule */}
            {currentUser && (
              <button
                onClick={() => {
                  setEditProfileName(currentUser.name);
                  setEditProfileCallsign(currentUser.callsign || "");
                  setEditProfileAvatar(currentUser.avatar || "👨‍🚀");
                  setShowProfileModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-slate-850 to-slate-900 border border-slate-700/80 rounded-full hover:border-pink-500 hover:shadow-[0_0_10px_rgba(236,72,153,0.3)] transition-all duration-300 cursor-pointer"
                title="จัดการโปรไฟล์และการเรียนรู้"
              >
                <span className="text-sm shrink-0 leading-none">{currentUser.avatar || "👨‍🚀"}</span>
                <div className="flex flex-col items-start leading-none text-left">
                  <span className="text-[10px] font-black text-white max-w-[80px] sm:max-w-[120px] truncate block">
                    {currentUser.name}
                  </span>
                  {currentUser.callsign && (
                    <span className="text-[8px] font-mono font-bold text-pink-500 mt-0.5 block">
                      {currentUser.callsign}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}

            {/* Connection badge */}
            <div className="flex flex-col items-center sm:items-end shrink-0">
              <span className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-0.5">Connection</span>
              <span className="text-[10px] text-green-400 font-mono flex items-center gap-1 leading-none font-bold">
                STATION ACTIVE ●
              </span>
            </div>

          </div>
        </div>
      </header>

      {/* QUICK AUDIO CONSOLE & ACCESSIBILITY BAR */}
      <div className={`border-b py-2.5 px-4 md:px-8 transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-200/40 border-slate-300 text-slate-700'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* WPM Slider */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-bold uppercase tracking-wider text-[10px] text-pink-600 dark:text-pink-500 shrink-0">SPEED (WPM):</span>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <input 
                  type="range" 
                  min="5" 
                  max="40" 
                  value={wpm} 
                  onChange={(e) => setWpm(parseInt(e.target.value, 10))}
                  className="w-full sm:w-32 md:w-40 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  id="wpm-slider-subheader"
                />
                <span className="font-mono font-black text-pink-600 dark:text-pink-500 w-12 text-right">{wpm} WPM</span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-4 bg-slate-400 dark:bg-slate-700" />

            {/* Tone Frequency Slider */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <span className="font-bold uppercase tracking-wider text-[10px] text-blue-600 dark:text-blue-500 shrink-0">TONE (Hz):</span>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <input 
                  type="range" 
                  min="400" 
                  max="1000" 
                  step="50"
                  value={frequency} 
                  onChange={(e) => setFrequency(parseInt(e.target.value, 10))}
                  className="w-full sm:w-32 md:w-40 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  id="freq-slider-subheader"
                />
                <span className="font-mono font-black text-blue-600 dark:text-blue-500 w-16 text-right">{frequency} Hz</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Font Size Selector (ขนาดตัวอักษร) */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <span className="font-bold uppercase tracking-wider text-[10px] text-pink-600 dark:text-pink-500 shrink-0">FONT SIZE (ZOOM):</span>
              <div className="flex items-center bg-slate-300 dark:bg-slate-850 rounded-full p-0.5 border border-slate-400 dark:border-slate-700">
                {[
                  { label: 'A-', size: 95, title: 'เล็ก (Small)' },
                  { label: 'A', size: 110, title: 'ปกติ (Normal)' },
                  { label: 'A+', size: 125, title: 'ใหญ่ (Large)' },
                  { label: 'A++', size: 140, title: 'ใหญ่มาก (Extra Large)' }
                ].map(opt => (
                  <button 
                    key={opt.size}
                    onClick={() => setFontSize(opt.size)}
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${fontSize === opt.size ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-black shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title={opt.title}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CORE DISPLAY (SIGNAL BEACON & SOUND WAVE VISUALIZER) */}
      <section className={`py-6 px-4 md:px-8 border-b transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/80 border-slate-200'}`} id="signal-viz-section">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Signal Lamp LED */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4">
            <div className="relative">
              <motion.div 
                animate={{
                  scale: isBeeping ? [1, 1.15, 1] : 1,
                }}
                transition={{ duration: 0.1 }}
                className={`w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all duration-75 ${
                  isBeeping 
                    ? 'bg-pink-500 border-pink-300 shadow-[0_0_40px_rgba(236,72,153,0.9)] text-white' 
                    : theme === 'dark' 
                      ? 'bg-slate-800 border-slate-700 text-slate-500' 
                      : 'bg-slate-200 border-slate-300 text-slate-400'
                }`}
              >
                <Activity className="w-10 h-10" />
              </motion.div>
              {/* Halos */}
              {isBeeping && (
                <span className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
              )}
            </div>
            <div className="text-center mt-3">
              <span className={`text-xs font-display font-extrabold tracking-widest uppercase ${isBeeping ? 'text-pink-500 font-bold' : 'text-slate-400'}`}>
                {isBeeping ? '● TX TRANSMITTING...' : '◌ RX WAITING / STANDBY'}
              </span>
            </div>
          </div>

          {/* Active Audio Output Text Highlight */}
          <div className="md:col-span-8 flex flex-col justify-center p-6 rounded-2xl border bg-black text-[#10B981] min-h-[120px] border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)] relative overflow-hidden font-mono">
            <div className="absolute top-2 right-3 flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider text-pink-500">
              <Activity className="w-3 h-3 text-pink-500 animate-pulse" />
              <span>Oscilloscope Signal</span>
            </div>

            {/* Simulated Scrolling Audio Waveform */}
            <div className="absolute bottom-0 left-0 w-full h-8 flex items-end gap-0.5 opacity-30 pointer-events-none">
              {Array.from({ length: 40 }).map((_, i) => (
                <div 
                  key={i} 
                  className="bg-[#10B981] w-full rounded-t"
                  style={{ 
                    height: isBeeping ? `${Math.floor(Math.random() * 90) + 10}%` : '4px',
                    transition: isBeeping ? 'height 0.08s ease' : 'height 0.5s ease'
                  }}
                />
              ))}
            </div>

            {/* Currently playing text display */}
            <div className="z-10">
              <div className="text-[10px] uppercase tracking-widest text-emerald-500 mb-1 font-mono">ข้อความที่กำลังเล่นเสียง:</div>
              <div className="text-xl md:text-2xl font-mono font-bold tracking-widest text-[#10B981] min-h-[36px] flex flex-wrap gap-x-2 items-center neon-text-green">
                {playbackText ? (
                  playbackText.split("").map((char, charIdx) => {
                    const isSpace = char === " ";
                    const isPlayed = charIdx < activeAudioState.activeLetterIndex || 
                      (activeAudioState.activeWordIndex > 0 && charIdx < playbackText.length); // simple highlight logic
                    const isActive = charIdx === activeAudioState.activeLetterIndex;

                    return (
                      <span 
                        key={charIdx} 
                        className={`transition-all duration-150 py-0.5 px-1 rounded ${
                          isActive 
                            ? 'bg-[#10B981] text-black font-black scale-110 shadow-lg border border-emerald-400' 
                            : isPlayed 
                              ? 'text-[#10B981] border-b border-emerald-500/40 font-black' 
                              : 'text-emerald-900 font-medium'
                        }`}
                      >
                        {isSpace ? '␣' : char}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-emerald-700 text-sm md:text-base font-mono font-normal italic">
                    คลิกเล่นเสียงคู่มือ ข้อมูลแคมเปญ หรือเคาะด้านล่าง เพื่อเริ่มต้นการฝึกฝน...
                  </span>
                )}
              </div>

              {/* Symbol indicator (dot or dash breakdown) */}
              <div className="mt-2 min-h-[20px]">
                {isPlayingSound && activeAudioState.activeSymbolIndex !== -1 && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                    <span>รหัสปัจจุบัน:</span>
                    <span className="text-sm font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/60 text-emerald-300">
                      {activeAudioState.symbolPlaying === 'dot' ? 'ดอท (.)' : activeAudioState.symbolPlaying === 'dash' ? 'แดช (-)' : 'เว้นระยะ'}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8" id="main-content-layout">
        
        {/* RE-REGISTRATION BANNER / NOTIFICATION */}
        {currentUser?.needsReRegistration && (
          <div className="lg:col-span-12 bg-gradient-to-r from-amber-600 to-rose-600 text-white p-4 rounded-2xl shadow-lg border border-amber-500/40 animate-pulse flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="text-left">
                <h4 className="font-bold font-display text-sm uppercase tracking-wide">กรุณาลงทะเบียนข้อมูลสมาชิกใหม่ (Re-registration Request)</h4>
                <p className="text-xs opacity-90 mt-0.5">ผู้ดูแลระบบขอความกรุณาให้ท่านอัปเดตข้อมูลประวัติสมาชิกวิทยุสมัครเล่นใหม่เนื่องจาก: <strong className="underline text-yellow-100">{currentUser.reRegistrationReason}</strong></p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditProfileName(currentUser.name);
                setEditProfileCallsign(currentUser.callsign || "");
                setEditProfileAvatar(currentUser.avatar || "👨‍🚀");
                setShowProfileModal(true);
              }}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-all uppercase tracking-wider shrink-0 cursor-pointer shadow-md"
            >
              แก้ไขโปรไฟล์ / ยืนยันตัวตนใหม่
            </button>
          </div>
        )}
        
        {/* SIDEBAR: MORSE REFERENCE GUIDE (lg:col-span-4) - RIGHT HAND SIDE */}
        <section className="lg:col-span-4 order-2" id="section-reference-guide">
          <div className={`p-6 rounded-2xl border sticky top-24 transition-all duration-300 shadow-xl ${
            theme === 'dark' 
              ? 'bg-slate-900 border-slate-800 text-slate-200' 
              : 'bg-white border-slate-300 text-slate-800'
          }`}>
            <h2 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 mb-4 tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <span>Morse Reference Guide</span>
            </h2>

            {/* Quick Search */}
            <div className="relative mb-4">
              <input 
                type="text" 
                placeholder="ค้นหา อักษร, เลข หรือรหัส..." 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className={`w-full text-xs px-3 py-2 pl-9 rounded-xl border focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 ${
                  theme === 'dark' 
                    ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600' 
                    : 'bg-slate-100 border-slate-200 text-slate-850 placeholder-slate-400'
                }`}
                id="search-ref-input"
              />
              <Info className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              {sidebarSearch && (
                <button 
                  onClick={() => setSidebarSearch("")}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold font-mono"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Scrollable Reference Table */}
            <div className="max-h-[440px] overflow-y-auto pr-1 space-y-4">
              
              {/* Letters */}
              {filteredAlphabet.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">ตัวอักษรภาษาอังกฤษ (Letters)</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm">
                    {filteredAlphabet.map(char => (
                      <button
                        key={char}
                        onClick={() => playLetterBeep(char)}
                        className={`flex justify-between border-b py-0.5 w-full text-left cursor-pointer hover:bg-pink-500/10 transition-colors ${
                          theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'
                        }`}
                        title="คลิกเพื่อฟังเสียงรหัส"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{char}</span>
                        <span className="text-pink-600 dark:text-pink-400 font-black">{MORSE_ALPHABET[char]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Numbers */}
              {filteredNumbers.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2 px-1">ตัวเลขสากล (Numbers)</h4>
                  <div className="grid grid-cols-1 gap-1 font-mono text-sm">
                    {filteredNumbers.map(char => (
                      <button
                        key={char}
                        onClick={() => playLetterBeep(char)}
                        className={`flex justify-between border-b py-0.5 w-full text-left cursor-pointer hover:bg-blue-500/10 transition-colors ${
                          theme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'
                        }`}
                        title="คลิกเพื่อฟังเสียงรหัส"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{char}</span>
                        <span className="text-slate-500">{MORSE_NUMBERS[char]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Abbreviations */}
              {filteredHamAbbr.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-2 px-1">รหัสย่อวิทยุสมัครเล่น</h4>
                  <div className="space-y-1">
                    {filteredHamAbbr.map(abbr => (
                      <button
                        key={abbr}
                        onClick={() => {
                          setPlaybackText(abbr);
                          audioEngine.current.play(abbr, wpm, frequency, false, (s) => setActiveAudioState(s), () => setIsPlayingSound(false));
                          setIsPlayingSound(true);
                        }}
                        className={`w-full flex flex-col p-2 rounded-xl border text-left transition-all hover:border-blue-500/50 cursor-pointer ${
                          theme === 'dark' 
                            ? 'bg-slate-950/60 border-slate-800 text-slate-300' 
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                        title="คลิกเพื่อฟังเสียงรหัส"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-blue-600 dark:text-blue-400">{abbr}</span>
                          <span className="font-mono text-xs font-bold text-slate-500">{textToMorse(abbr)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 leading-none">{HAM_ABBREVIATIONS[abbr].thaiDefinition}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredAlphabet.length === 0 && filteredNumbers.length === 0 && filteredHamAbbr.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  ไม่พบรหัสที่ตรงกับการค้นหา "{sidebarSearch}"
                </div>
              )}

            </div>

            {/* Quick Tips */}
            <div className={`mt-4 p-3 rounded-xl border text-[11px] leading-relaxed ${
              theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-pink-50/50 border-pink-100 text-slate-600'
            }`}>
              <p className="font-bold text-pink-500 mb-1">💡 เคล็ดลับการฝึกฝน:</p>
              รหัสมอร์สไม่มีขีดจำกัดด้านภาษา พยายามจำเสียงรวมของอักษร (เช่น "ดิต-ดา" สำหรับ A) แทนที่จะมองเห็นขีดจุดในใจ จะทำให้แปลเสียงความเร็วสูงได้ง่ายขึ้น!
            </div>
          </div>
        </section>

        {/* MAIN PANEL CONTENT (lg:col-span-8) - LEFT HAND SIDE */}
        <section className="lg:col-span-8 order-1 space-y-6" id="section-main-modes">
          
          {/* TABS SELECTOR */}
          <div className={`flex gap-1.5 p-1 rounded-xl w-full sm:w-fit overflow-x-auto ${
            theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-200'
          }`} id="tabs-navbar">
            
            <button
              onClick={() => { setActiveTab('campaign'); stopPlayback(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'campaign'
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-extrabold shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
              id="tab-btn-campaign"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>โหมดแคมเปญฝึกฟัง</span>
            </button>
 
            <button
              onClick={() => { setActiveTab('custom'); stopPlayback(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-extrabold shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
              id="tab-btn-custom"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>ฝึกฟังกำหนดเอง</span>
            </button>

            <button
              onClick={() => { setActiveTab('drills'); stopPlayback(); if (!drillTarget) { generateDrill('letters'); } }}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'drills'
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-extrabold shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
              id="tab-btn-drills"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>ฝึกถอดรหัสแบบสุ่ม (Drills)</span>
            </button>
 
            <button
              onClick={() => { setActiveTab('keyer'); stopPlayback(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'keyer'
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-extrabold shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
              id="tab-btn-keyer"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>เคาะคีย์อิสระ</span>
            </button>
 
            <button
              onClick={() => { setActiveTab('achievements'); stopPlayback(); }}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'achievements'
                  ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white font-extrabold shadow-sm'
                  : theme === 'dark' ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
              id="tab-btn-achievements"
            >
              <Award className="w-3.5 h-3.5" />
              <span>เหรียญตราเกียรติยศ</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => { setActiveTab('admin'); stopPlayback(); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-extrabold shadow-sm border-amber-400'
                    : theme === 'dark'
                      ? 'text-amber-400 hover:text-amber-100 hover:bg-amber-950/20 border-amber-500/20'
                      : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50/50 border-amber-400/20'
                }`}
                id="tab-btn-admin"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>แผงควบคุมแอดมิน (Admin)</span>
              </button>
            )}
 
          </div>

          {/* TAB 1: CAMPAIGN GAMEPLAY */}
          {activeTab === 'campaign' && (
            <div className="space-y-6" id="panel-campaign">
              
              {!activeLevel ? (
                // Level Selection Map
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                    <div>
                      <h2 className="text-xl font-display font-extrabold flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-pink-500" />
                        <span>แคมเปญฝึกฝนนักวิทยุ SPU ARC</span>
                      </h2>
                      <p className="text-xs text-slate-400">เอาชนะทั้ง 10 ด่านเพื่อเป็นสุดยอดนักถอดรหัส CW ของชมรม!</p>
                    </div>
                  </div>

                  {/* Level Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CAMPAIGN_LEVELS.map(level => {
                      const isLocked = level.id > unlockedLevel;
                      const highScore = highScores[level.id] || 0;
                      const stars = levelStars[level.id] || 0;

                      return (
                        <div 
                          key={level.id}
                          className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                            isLocked 
                              ? theme === 'dark' 
                                ? 'bg-slate-900/10 border-slate-800/80 text-slate-500' 
                                : 'bg-slate-100/60 border-slate-200 text-slate-400'
                              : theme === 'dark'
                                ? 'bg-slate-900/60 border-slate-800 hover:border-pink-500/60 text-slate-100 hover:shadow-lg hover:shadow-slate-950/20'
                                : 'bg-white border-slate-200 hover:border-pink-500/60 text-slate-800 shadow-xs hover:shadow-md'
                          }`}
                        >
                          {/* Top row */}
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded ${
                              isLocked 
                                ? 'bg-slate-800 text-slate-600' 
                                : 'bg-pink-500/10 text-pink-500'
                            }`}>
                              LEVEL {level.id}
                            </span>
                            
                            {/* Stars */}
                            {!isLocked && (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3].map(s => (
                                  <Star 
                                    key={s} 
                                    className={`w-4 h-4 ${
                                      s <= stars 
                                        ? 'text-pink-500 fill-pink-500' 
                                        : 'text-slate-600 fill-transparent'
                                    }`} 
                                  />
                                ))}
                              </div>
                            )}

                            {isLocked && <Lock className="w-4 h-4 text-slate-600" />}
                          </div>

                          {/* Level Details */}
                          <h4 className={`text-base font-display font-extrabold mb-1 ${isLocked ? 'text-slate-500' : ''}`}>
                            {level.title}
                          </h4>
                          <p className={`text-xs mb-3 line-clamp-2 ${isLocked ? 'text-slate-500/70' : 'text-slate-400'}`}>
                            {level.description}
                          </p>

                          {/* Target Characters */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-4">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">เป้าหมายฝึก:</span>
                            {level.targets.map(t => (
                              <span 
                                key={t} 
                                className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                                  isLocked 
                                    ? 'bg-slate-800/40 text-slate-600' 
                                    : 'bg-slate-850 text-pink-500 border border-slate-750'
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>

                          {/* Footer Action */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/20">
                            <span className="text-[11px] font-mono">
                              {!isLocked && highScore > 0 ? `คะแนนสูงสุด: ${highScore} pts` : ''}
                            </span>
                            
                            {!isLocked ? (
                              <button
                                onClick={() => selectLevel(level)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-display font-extrabold bg-gradient-to-r from-pink-500 to-blue-500 text-white rounded-lg transition-all hover:opacity-95 cursor-pointer"
                              >
                                <span>เริ่มเล่นด่านนี้</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-xs italic text-slate-600">Locked</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Inside an active level game viewport
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                  theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`} id="campaign-gameplay-viewport">
                  
                  {/* Summary overlay at level end */}
                  {showLevelSummary ? (
                    (() => {
                      const achievedScore = campaignScores.reduce((a, b) => a + b, 0);
                      const isSuccess = achievedScore >= 350;
                      return (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={
                            isSuccess
                              ? {
                                  scale: [0.95, 1, 1],
                                  opacity: [0, 1, 1],
                                  x: [0, -18, 18, -18, 18, -12, 12, -6, 6, 0],
                                  y: [0, 12, -12, 12, -12, 8, -8, 4, -4, 0],
                                }
                              : { scale: 1, opacity: 1 }
                          }
                          transition={{
                            duration: 0.65,
                            ease: "easeOut"
                          }}
                          className={`text-center py-6 space-y-6 relative rounded-2xl border-2 p-6 transition-all duration-300 ${
                            isSuccess 
                              ? 'border-[#10B981] bg-black neon-glow-green' 
                              : 'border-slate-800 bg-slate-900/60 shadow-lg'
                          }`}
                        >
                          {/* Absolute flashing ambient light overlay if success */}
                          {isSuccess && (
                            <motion.div 
                              initial={{ opacity: 0.8 }}
                              animate={{ opacity: [0.8, 0, 0.9, 0.1, 0.6, 0] }}
                              transition={{ duration: 0.8, ease: "linear" }}
                              className="absolute inset-0 bg-[#10B981]/20 rounded-2xl pointer-events-none z-50 mix-blend-screen"
                            />
                          )}
                          
                          {/* Dramatic floating particle sparkles if success */}
                          {isSuccess && (
                            <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ 
                                    opacity: 0, 
                                    scale: 0.5,
                                    x: Math.random() * 300 - 150, 
                                    y: Math.random() * 200 - 100 
                                  }}
                                  animate={{ 
                                    opacity: [0, 1, 0], 
                                    scale: [0.5, 1.8, 0.5],
                                    y: [Math.random() * 200 - 100, Math.random() * 200 - 250]
                                  }}
                                  transition={{ 
                                    duration: 1.5 + Math.random() * 1.5, 
                                    repeat: Infinity,
                                    delay: Math.random() * 0.8
                                  }}
                                  className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]"
                                />
                              ))}
                            </div>
                          )}

                          <div className="inline-flex p-4 rounded-full bg-pink-500/10 text-pink-500 justify-center">
                            <Trophy className={`w-16 h-16 ${isSuccess ? 'text-emerald-400 animate-bounce' : 'text-slate-400'}`} />
                          </div>
                          
                          <div>
                            <h3 className={`text-2xl font-display font-extrabold ${isSuccess ? 'text-emerald-400 neon-text-green' : 'text-slate-400'}`}>
                              {isSuccess ? `🎉 ผ่านด่านเรียบร้อย!` : `สรุปการฝึกฝนด่าน ${activeLevel.id}`}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">{activeLevel.title}</p>
                          </div>

                          {/* Score metrics */}
                          <div className="max-w-sm mx-auto grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 font-mono">
                            <div>
                              <div className="text-xs text-slate-500">คะแนนในรอบนี้</div>
                              <div className={`text-2xl font-bold ${isSuccess ? 'text-emerald-400 neon-text-green' : 'text-pink-500'}`}>
                                {achievedScore} pts
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">ความแม่นยำถอดรหัส</div>
                              <div className="text-2xl font-bold text-emerald-500">
                                {campaignScores.filter(s => s > 0).length} / 5 ข้อ
                              </div>
                            </div>
                          </div>

                          {/* Stars Display */}
                          <div className="flex items-center justify-center gap-2">
                            {[1, 2, 3].map(starIndex => {
                              let starActive = false;
                              if (starIndex === 1 && achievedScore >= 350) starActive = true;
                              if (starIndex === 2 && achievedScore >= 420) starActive = true;
                              if (starIndex === 3 && achievedScore === 500) starActive = true;

                              return (
                                <Star 
                                  key={starIndex}
                                  className={`w-10 h-10 ${
                                    starActive 
                                      ? 'text-emerald-400 fill-emerald-400 animate-bounce' 
                                      : 'text-slate-700'
                                  }`}
                                  style={{ animationDelay: `${starIndex * 150}ms` }}
                                />
                              );
                            })}
                          </div>

                          <div className="text-sm">
                            {isSuccess ? (
                              <span className="text-emerald-400 font-bold neon-text-green">🎉 ยินดีด้วยคุณสอบผ่านระดับนี้เรียบร้อยแล้ว! ระดับถัดไปได้รับการปลดล็อก</span>
                            ) : (
                              <span className="text-rose-500 font-bold">❌ คะแนนยังไม่ถึงเกณฑ์ 350 คะแนน ลองใหม่อีกครั้งเพื่อผ่านระดับนี้</span>
                            )}
                          </div>

                          {/* Table of answers breakdown */}
                          <div className="max-w-md mx-auto text-left text-xs bg-slate-950 p-4 rounded-xl space-y-1.5 border border-slate-800 font-mono">
                            <div className="border-b border-slate-800 pb-1.5 mb-1.5 font-bold flex justify-between text-slate-400">
                              <span>คำถาม</span>
                              <span>คำตอบของคุณ</span>
                            </div>
                            {campaignQuestions.map((q, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-pink-500 font-bold">{q}</span>
                                <span className={campaignAnswers[idx] === q ? 'text-emerald-500' : 'text-rose-500'}>
                                  {campaignAnswers[idx]} {campaignAnswers[idx] === q ? '✓' : '✗'}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Buttons */}
                          <div className="flex justify-center gap-3 relative z-10">
                            <button
                              onClick={() => setActiveLevel(null)}
                              className="px-4 py-2 text-sm font-semibold border border-slate-700/60 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                            >
                              กลับแผนที่ด่าน
                            </button>
                            <button
                              onClick={restartCurrentLevel}
                              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                                isSuccess 
                                  ? 'bg-[#10B981] hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20' 
                                  : 'bg-pink-500 hover:bg-pink-600 text-white shadow-md'
                              }`}
                            >
                              ฝึกซ้ำด่านนี้
                            </button>
                          </div>

                        </motion.div>
                      );
                    })()
                  ) : (
                    // Active Game Loop Display
                    <div className="space-y-4">
                      
                      {/* Top Header line */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
                        <div>
                          <h3 className="text-lg font-display font-extrabold text-pink-500">{activeLevel.title}</h3>
                          <span className="text-xs text-slate-400">ด่านทดสอบความแม่นยำ</span>
                        </div>
                        <button 
                          onClick={() => setActiveLevel(null)}
                          className="text-xs hover:text-pink-500 border border-slate-800 px-2.5 py-1 rounded-lg cursor-pointer"
                        >
                          ออกจากการทดสอบ
                        </button>
                      </div>

                      {/* ProgressBar indicators */}
                      <div className="flex items-center gap-2 py-2">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const isCompleted = idx < campaignRound;
                          const isActive = idx === campaignRound;
                          const isCorrect = campaignScores[idx] > 0;

                          return (
                            <div 
                              key={idx} 
                              className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                                isActive 
                                  ? 'bg-pink-500 ring-2 ring-pink-300' 
                                  : isCompleted 
                                    ? isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                                    : 'bg-slate-800'
                                }`} 
                            />
                          );
                        })}
                        <span className="text-xs font-mono font-bold text-slate-400 ml-1">ข้อที่ {campaignRound + 1}/5</span>
                      </div>

                      {/* Interactive Cockpit Playing Area (Signal Visualizer) */}
                      <div className={`relative h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                        theme === 'dark' 
                          ? 'bg-slate-950/60 border-slate-800' 
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        {/* Sound Wave Indicators decoration */}
                        <div className="absolute top-4 left-6 flex gap-1 items-end h-8">
                          <div className={`w-1 bg-pink-200 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-2'}`} />
                          <div className={`w-1 bg-pink-300 transition-all duration-75 ${isPlayingSound ? 'h-8' : 'h-3'}`} />
                          <div className={`w-1 bg-pink-400 transition-all duration-75 ${isPlayingSound ? 'h-5' : 'h-2'}`} />
                          <div className={`w-1 bg-pink-500 transition-all duration-75 ${isPlayingSound ? 'h-9' : 'h-4'}`} />
                          <div className={`w-1 bg-pink-400 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-3'}`} />
                        </div>

                        <button 
                          onClick={() => playCampaignQuestion(campaignQuestions[campaignRound])}
                          disabled={isPlayingSound}
                          className="w-24 h-24 bg-pink-500 rounded-full shadow-lg border-4 border-white dark:border-slate-800 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group"
                        >
                          {isPlayingSound ? (
                            <Volume2 className="w-10 h-10 text-white animate-pulse" />
                          ) : (
                            <Play className="w-10 h-10 text-white fill-current" />
                          )}
                        </button>
                        <p className={`mt-4 text-xs font-bold uppercase tracking-widest ${
                          isPlayingSound ? 'text-pink-500 animate-pulse' : 'text-slate-400'
                        }`}>
                          {isPlayingSound ? 'กำลังส่งรหัสสัญญาณ... (SIGNAL PLAYING)' : 'คลิกเพื่อฟังเสียงรหัสสัญญาณ (CLICK TO PLAY)'}
                        </p>
                      </div>

                      {/* Type input area */}
                      <div className="mt-8 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                          <input 
                            type="text"
                            placeholder="พิมพ์คำตอบที่คุณได้ยิน..."
                            value={userCampaignInput}
                            onChange={(e) => {
                              const filtered = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "");
                              setUserCampaignInput(filtered);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !campaignChecked && userCampaignInput.trim()) {
                                verifyCampaignAnswer();
                              }
                            }}
                            disabled={campaignChecked}
                            className={`w-full h-16 rounded-xl px-6 text-2xl font-mono uppercase tracking-widest border-2 outline-none transition-all ${
                              theme === 'dark' 
                                ? 'bg-slate-950 border-slate-800 text-white focus:border-pink-500' 
                                : 'bg-slate-100 border-transparent text-slate-900 focus:border-pink-500'
                            }`}
                            id="campaign-user-input"
                            autoFocus
                            autoComplete="off"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase hidden sm:block">Your Answer</div>
                        </div>

                        {!campaignChecked ? (
                          <button
                            onClick={verifyCampaignAnswer}
                            disabled={!userCampaignInput.trim()}
                            className={`h-16 px-10 rounded-xl font-bold transition-all shadow-lg active:translate-y-1 cursor-pointer shrink-0 ${
                              userCampaignInput.trim() 
                                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md' 
                                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            ตรวจสอบ (ENTER)
                          </button>
                        ) : (
                          <button
                            onClick={nextCampaignRound}
                            className="h-16 px-10 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold transition-all shadow-lg active:translate-y-1 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <span>{campaignRound === 4 ? 'สรุปคะแนน (SUMMARY)' : 'ข้อถัดไป (NEXT)'}</span>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                        {/* Error & Try Again options */}
                        {campaignChecked && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-xl border flex items-center gap-3 ${
                              campaignCorrect 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                            }`}
                          >
                            {campaignCorrect ? (
                              <>
                                <CheckCircle2 className="w-6 h-6 shrink-0" />
                                <div>
                                  <h4 className="font-bold">ถูกต้องที่สุด! ({campaignScores[campaignRound]} pts)</h4>
                                  <p className="text-xs text-slate-400 mt-0.5">คุณถอดรหัสข้อความนี้สำเร็จด้วยดี</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-6 h-6 shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-bold">คำตอบยังไม่ถูกต้อง</h4>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    เฉลยรหัสที่ได้ยินคือ: <strong className="text-pink-500 tracking-wider text-sm font-mono">{campaignQuestions[campaignRound]}</strong>
                                  </p>
                                </div>
                              </>
                            )}
                          </motion.div>
                        )}

                        {/* Help options before submission verified */}
                        {!campaignChecked && (
                          <div className="flex items-center justify-between text-xs px-1">
                            <span className="text-slate-500">
                              พยายามครั้งที่: <strong className="text-slate-300 font-mono">{campaignAttempts}</strong>
                            </span>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => playCampaignQuestion(campaignQuestions[campaignRound])}
                                className="text-slate-400 hover:text-pink-500 cursor-pointer"
                              >
                                ฟังซ้ำ
                              </button>
                              <span className="text-slate-700">|</span>
                              <button
                                onClick={skipOrAcceptWrong}
                                className="text-slate-400 hover:text-rose-500 font-semibold cursor-pointer"
                              >
                                ยอมแพ้ & เฉลยคำตอบ
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                </div>
              )}

            </div>
          )}

          {/* TAB 2: CUSTOM PRACTICE */}
          {activeTab === 'custom' && (
            <div className="space-y-6" id="panel-custom-practice">
              <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex flex-col md:flex-row justify-between md:items-center border-b pb-4 mb-4 border-slate-800/40 gap-3">
                  <div>
                    <h2 className="text-xl font-display font-extrabold flex items-center gap-2">
                      <HelpCircle className="w-6 h-6 text-pink-500" />
                      <span>โหมดฝึกฟังกำหนดเอง (Custom Listening)</span>
                    </h2>
                    <p className="text-xs text-slate-400">ปรับแต่งระดับการเรียนรู้ เลือกความยาวและประเภทได้ตามใจชอบ</p>
                  </div>
                  
                  {/* Streak displays */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Streak:</span>
                    <span className="text-sm font-mono font-bold bg-gradient-to-r from-pink-500 to-blue-500 text-white px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3.5 h-3.5" />
                      {customStreak}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">(สถิติสูงสุด: {maxCustomStreak})</span>
                  </div>
                </div>

                {/* Configuration Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Category select */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">1. เลือกหมวดหมู่ฝึกฝน</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'letters', label: 'เฉพาะอักษร', desc: 'A - Z' },
                        { id: 'numbers', label: 'เฉพาะตัวเลข', desc: '0 - 9' },
                        { id: 'mixed', label: 'ผสมอักษร+เลข', desc: 'A-Z และ 0-9' },
                        { id: 'abbreviations', label: 'รหัสย่อวิทยุแฮม', desc: 'CQ, DE, 73' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCustomCategory(cat.id as any)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            customCategory === cat.id
                              ? 'bg-pink-500 border-pink-400 text-white font-bold shadow-xs'
                              : theme === 'dark'
                                ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-bold">{cat.label}</div>
                          <div className={`text-[10px] ${customCategory === cat.id ? 'text-white/90' : 'text-slate-500'}`}>{cat.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sequence Length slider */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        2. ความยาวของกลุ่มรหัส
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="1"
                          max="5"
                          disabled={customCategory === 'abbreviations'}
                          value={customLength}
                          onChange={(e) => setCustomLength(parseInt(e.target.value, 10))}
                          className="flex-1 h-2 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-pink-500 disabled:opacity-50"
                        />
                        <span className="font-mono text-sm font-bold text-pink-500 w-12 text-center bg-slate-950 py-1.5 px-2 rounded border border-slate-800">
                          {customCategory === 'abbreviations' ? '1-2 คำ' : `${customLength} ตัว`}
                        </span>
                      </div>
                    </div>

                    {/* Generate button */}
                    <button
                      onClick={generateCustomQuestion}
                      className="w-full py-3 bg-gradient-to-r from-pink-500 to-blue-500 text-white font-display font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 animate-spin-slow" />
                      <span>สร้างโจทย์ฝึกฟัง (Generate)</span>
                    </button>
                  </div>
                </div>

                {/* Question Area */}
                {customQuestion && (
                  <div className="space-y-6 border-t border-slate-800/20 pt-6">
                    {/* Signal Visualizer Box */}
                    <div className={`relative h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                      theme === 'dark' 
                        ? 'bg-slate-950/60 border-slate-800' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      {/* Sound Wave Indicators decoration */}
                      <div className="absolute top-4 left-6 flex gap-1 items-end h-8">
                        <div className={`w-1 bg-pink-200 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-2'}`} />
                        <div className={`w-1 bg-pink-300 transition-all duration-75 ${isPlayingSound ? 'h-8' : 'h-3'}`} />
                        <div className={`w-1 bg-pink-400 transition-all duration-75 ${isPlayingSound ? 'h-5' : 'h-2'}`} />
                        <div className={`w-1 bg-pink-500 transition-all duration-75 ${isPlayingSound ? 'h-9' : 'h-4'}`} />
                        <div className={`w-1 bg-pink-400 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-3'}`} />
                      </div>

                      <button 
                        onClick={() => playCustomQuestion(customQuestion)}
                        disabled={isPlayingSound}
                        className="w-20 h-20 bg-pink-500 rounded-full shadow-lg border-4 border-white dark:border-slate-800 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group"
                      >
                        {isPlayingSound ? (
                          <Volume2 className="w-8 h-8 text-white animate-pulse" />
                        ) : (
                          <Play className="w-8 h-8 text-white fill-current" />
                        )}
                      </button>
                      <p className={`mt-3 text-[11px] font-bold uppercase tracking-widest ${
                        isPlayingSound ? 'text-pink-500 animate-pulse' : 'text-slate-400'
                      }`}>
                        {isPlayingSound ? 'กำลังเล่นสัญญาณ... (PLAYING)' : 'คลิกเพื่อฟังเสียงรหัสสัญญาณ (PLAY SIGNAL)'}
                      </p>
                    </div>

                    {/* Answer area */}
                    <div className="mt-8 flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 relative">
                        <input 
                          type="text"
                          placeholder="พิมพ์คำตอบที่คุณได้ยิน..."
                          value={userCustomInput}
                          onChange={(e) => {
                            const filtered = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "");
                            setUserCustomInput(filtered);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !customChecked && userCustomInput.trim()) {
                                verifyCustomAnswer();
                            }
                          }}
                          disabled={customChecked}
                          className={`w-full h-16 rounded-xl px-6 text-2xl font-mono uppercase tracking-widest border-2 outline-none transition-all ${
                            theme === 'dark' 
                              ? 'bg-slate-950 border-slate-800 text-white focus:border-pink-500' 
                              : 'bg-slate-100 border-transparent text-slate-900 focus:border-pink-500'
                          }`}
                          autoComplete="off"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase hidden sm:block">Your Answer</div>
                      </div>

                      {!customChecked ? (
                        <button
                          onClick={verifyCustomAnswer}
                          disabled={!userCustomInput.trim()}
                          className={`h-16 px-10 rounded-xl font-bold transition-all shadow-lg active:translate-y-1 cursor-pointer shrink-0 ${
                            userCustomInput.trim() 
                              ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md' 
                              : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          ตรวจสอบ (ENTER)
                        </button>
                      ) : (
                        <button
                          onClick={generateCustomQuestion}
                          className="h-16 px-10 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold transition-all shadow-lg active:translate-y-1 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <span>โจทย์ถัดไป (NEXT)</span>
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                      {/* Attempts count */}
                      {!customChecked && (
                        <div className="flex justify-between items-center text-xs px-1 text-slate-500">
                          <span>พยายามครั้งที่: <b className="font-mono">{customAttempts}</b></span>
                          <button
                            onClick={() => {
                              setCustomChecked(true);
                              setCustomCorrect(false);
                              setCustomStreak(0);
                            }}
                            className="text-slate-500 hover:text-rose-500 cursor-pointer font-medium"
                          >
                            ยอมแพ้ & แสดงเฉลย
                          </button>
                        </div>
                      )}

                      {/* Correct/Incorrect Notification */}
                      {customChecked && (
                        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                          customCorrect 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                        }`}>
                          {customCorrect ? (
                            <>
                              <CheckCircle2 className="w-6 h-6 shrink-0" />
                              <div>
                                <h4 className="font-bold">ถูกต้องสมบูรณ์!</h4>
                                <p className="text-xs text-slate-400 mt-0.5">คุณถอดเสียงตัวย่อสะกดถูกต้องตามมาตรฐานสากล</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-6 h-6 shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-bold">ยังไม่ถูกต้อง</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  รหัสที่แท้จริงคือ: <strong className="text-pink-500 text-sm font-mono tracking-wider">{customQuestion}</strong>
                                </p>
                                {customCategory === 'abbreviations' && HAM_ABBREVIATIONS[customQuestion] && (
                                  <p className="text-[11px] text-pink-500/80 mt-1 font-sans">
                                    ความหมายวิทยุแฮม: {HAM_ABBREVIATIONS[customQuestion].thaiDefinition} ({HAM_ABBREVIATIONS[customQuestion].definition})
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  )}

              </div>
            </div>
          )}

          {/* TAB: RANDOMIZED DECODING DRILLS */}
          {activeTab === 'drills' && (
            <div className="space-y-6" id="panel-decoding-drills">
              <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between md:items-center border-b pb-4 mb-4 border-slate-800/40 gap-3">
                  <div>
                    <h2 className="text-xl font-display font-extrabold flex items-center gap-2">
                      <Trophy className="text-pink-500 w-6 h-6" />
                      <span>โหมดฝึกถอดรหัสรหัสวิทยุแบบสุ่ม (Tactical Decoding Drills)</span>
                    </h2>
                    <p className="text-xs text-slate-400">พัฒนาหูฟังของคุณด้วยการจำลองความยากคลื่นรบกวนวิทยุจริง (QRM) และเวลาจำกัด</p>
                  </div>
                  
                  {/* Streak and stats */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">สถิติต่อเนื่อง (Streak):</span>
                    <span className="text-sm font-mono font-bold bg-pink-500 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-sm animate-pulse neon-glow-pink">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      {drillStreak}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">(สถิติสูงสุด: {maxDrillStreak})</span>
                  </div>
                </div>

                {/* Tactical Game Status HUD */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-black p-4 rounded-xl border border-pink-500/50 neon-glow-pink">
                  <div className="flex flex-col items-center justify-center p-2 border-r border-slate-800/50">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">TACTICAL LEVEL</span>
                    <span className="text-xl font-mono font-black text-pink-500 mt-1 neon-text-pink">
                      {drillLevel === 1 ? "01 / FIRST STEP" : drillLevel === 2 ? "02 / APPRENTICE" : "03 / PRO HAM"}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center p-2 border-r border-slate-800/50">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">SPEED (WPM)</span>
                    <span className="text-xl font-mono font-black text-[#10B981] mt-1 neon-text-green">
                      {drillLevel === 1 ? 10 : drillLevel === 2 ? 15 : 20} WPM
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center p-2">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">DECODE TIMER</span>
                    {drillTimer !== null ? (
                      <span className={`text-xl font-mono font-black mt-1 ${drillTimer <= 10 ? 'text-rose-500 animate-pulse' : 'text-orange-500'}`}>
                        00:{drillTimer.toString().padStart(2, "0")} SEC
                      </span>
                    ) : (
                      <span className="text-xl font-mono font-black text-slate-600 mt-1">
                        NO LIMIT
                      </span>
                    )}
                  </div>
                </div>

                {/* Game Difficulty Level Selector */}
                <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-pink-500" />
                      <span>ระดับความยากการฝึกฝน (GAME DIFFICULTY)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">จำลองการถอดรหัสด้วยความเร็ว และเสียงรบกวนสัญญาณจริงตามระดับ</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 1, label: 'LEVEL 1: FIRST STEP', speed: '10 WPM', noise: 'ไม่มี', timer: 'ไม่มี', desc: 'ระดับทดสอบพื้นฐาน 10 WPM ถอดรหัสผ่านเพื่อปลดรับใบเซอร์' },
                      { id: 2, label: 'LEVEL 2: APPRENTICE', speed: '15 WPM', noise: 'เบา', timer: 'ไม่มี', desc: 'ระดับความเร็ว 15 WPM พร้อมสัญญาณคลื่นแทรกคลื่นรบกวนวิทยุ QRM' },
                      { id: 3, label: 'LEVEL 3: PRO HAM', speed: '20 WPM', noise: 'สูง', timer: '30 วินาที', desc: 'ระดับความไวสูงสุด 20 WPM ท้าทายด้วยคลื่นวิทยุรบกวนสูงและจับเวลา 30 วิ' }
                    ].map(lvl => {
                      const isLocked = lvl.id > maxUnlockedDrillLevel;
                      const isActive = drillLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          disabled={isLocked}
                          onClick={() => {
                            setDrillLevel(lvl.id as any);
                            generateDrill(drillType, lvl.id as any);
                          }}
                          className={`px-3 py-2 rounded-lg border text-center transition-all flex flex-col items-center min-w-[130px] ${
                            isLocked
                              ? 'border-slate-900 bg-slate-950/40 text-slate-600 cursor-not-allowed opacity-50'
                              : isActive
                                ? 'border-pink-500 bg-pink-500/10 text-white neon-glow-pink cursor-pointer'
                                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 cursor-pointer'
                          }`}
                          title={isLocked ? "ล็อคอยู่: ต้องผ่านระดับก่อนหน้าด้วยความแม่นยำ 100% ก่อน" : lvl.desc}
                        >
                          <span className="text-[10px] font-black tracking-wider flex items-center gap-1">
                            {isLocked ? <Lock className="w-3.5 h-3.5 text-slate-600" /> : isActive ? <Sparkles className="w-3.5 h-3.5 text-pink-500" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
                            {lvl.label}
                          </span>
                          <span className="text-[9px] opacity-75 mt-0.5">{lvl.speed} | รบกวน {lvl.noise} | {lvl.timer}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Score Card Dashboard */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className={`p-3 rounded-xl border flex flex-col justify-center items-center ${
                    theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">ความแม่นยำเฉลี่ย</span>
                    <span className="text-xl font-black text-pink-500 font-mono mt-1">
                      {drillHistory.length > 0 
                        ? `${Math.round(drillHistory.reduce((acc, h) => acc + h.accuracy, 0) / drillHistory.length)}%`
                        : "0%"
                      }
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border flex flex-col justify-center items-center ${
                    theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">ฝึกฝนแล้ว</span>
                    <span className="text-xl font-black text-blue-500 font-mono mt-1">
                      {drillHistory.length} ครั้ง
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border flex flex-col justify-center items-center ${
                    theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">ถูกต้องสมบูรณ์</span>
                    <span className="text-xl font-black text-emerald-500 font-mono mt-1">
                      {drillHistory.filter(h => h.accuracy === 100).length} ครั้ง
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border flex flex-col justify-center items-center ${
                    theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">ความเร็วฟัง (Speed)</span>
                    <span className="text-xl font-black text-orange-500 font-mono mt-1">
                      {drillLevel === 1 ? 10 : drillLevel === 2 ? 15 : 20} WPM
                    </span>
                  </div>
                </div>

                {/* Main Drills Interface divided into 2 cols */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Generator Configuration & Target Player */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    {/* Category Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">1. เลือกประเภทการฝึกฝนแบบสุ่ม</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'letters', label: '🔠 อักษรสุ่ม 5 ตัว', desc: 'Random Code Groups' },
                          { id: 'numbers', label: '🔢 ตัวเลขสุ่ม 5 ตัว', desc: 'Random Numbers' },
                          { id: 'words', label: '📝 คำศัพท์ภาษาอังกฤษ', desc: 'Common Words' },
                          { id: 'ham', label: '📻 ตัวย่อและรหัสแฮม', desc: 'Amateur Radio Lingo' },
                          { id: 'mixed', label: '🌀 ผสมแบบสุ่มพิเศษ', desc: 'Text, Numbers, Abbr' }
                        ].map(type => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setDrillType(type.id as any);
                              generateDrill(type.id as any);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              drillType === type.id
                                ? 'bg-gradient-to-r from-pink-500 to-blue-500 border-pink-400 text-white font-bold shadow-md'
                                : theme === 'dark'
                                  ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="text-xs font-bold">{type.label}</div>
                            <div className={`text-[9px] mt-0.5 ${drillType === type.id ? 'text-white/80' : 'text-slate-500'}`}>{type.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Drills Playback Stage */}
                    <div className={`relative h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                      theme === 'dark' 
                        ? 'bg-slate-950/60 border-slate-800' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      {/* Audio Pulse Visualizer */}
                      <div className="absolute top-4 left-6 flex gap-1 items-end h-8">
                        <div className={`w-1 bg-pink-350 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-2'}`} />
                        <div className={`w-1 bg-pink-450 transition-all duration-75 ${isPlayingSound ? 'h-8' : 'h-3'}`} />
                        <div className={`w-1 bg-pink-500 transition-all duration-75 ${isPlayingSound ? 'h-5' : 'h-2'}`} />
                        <div className={`w-1 bg-pink-400 transition-all duration-75 ${isPlayingSound ? 'h-6' : 'h-3'}`} />
                      </div>

                      <button 
                        onClick={() => playDrillQuestion(drillTarget)}
                        disabled={isPlayingSound || !drillTarget}
                        className="w-20 h-20 bg-pink-500 rounded-full shadow-lg border-4 border-white dark:border-slate-800 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group"
                      >
                        {isPlayingSound ? (
                          <Volume2 className="w-8 h-8 text-white animate-pulse" />
                        ) : (
                          <Play className="w-8 h-8 text-white fill-current" />
                        )}
                      </button>
                      <p className={`mt-3 text-xs font-bold uppercase tracking-widest ${
                        isPlayingSound ? 'text-pink-500 animate-pulse' : 'text-slate-400'
                      }`}>
                        {isPlayingSound ? 'กำลังเปิดเสียงสัญญาณมอร์ส... (PLAYING)' : 'คลิกเพื่อฟังเสียงสัญญาณซ้ำ (REPLAY)'}
                      </p>
                    </div>

                    {/* Typing area and verification */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text"
                          placeholder="พิมพ์ข้อความที่คุณได้ยินที่นี่..."
                          value={userDrillInput}
                          onChange={(e) => {
                            const filtered = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "");
                            setUserDrillInput(filtered);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !drillChecked && userDrillInput.trim()) {
                              verifyDrillAnswer();
                            }
                          }}
                          disabled={drillChecked}
                          className={`flex-1 h-14 rounded-xl px-4 text-xl font-mono uppercase tracking-widest border-2 outline-none transition-all ${
                            theme === 'dark' 
                              ? 'bg-slate-950 border-slate-800 text-white focus:border-pink-500' 
                              : 'bg-slate-100 border-transparent text-slate-900 focus:border-pink-500'
                          }`}
                          autoComplete="off"
                          id="drill-input-field"
                        />
                        
                        {!drillChecked ? (
                          <button
                            onClick={verifyDrillAnswer}
                            disabled={!userDrillInput.trim()}
                            className={`h-14 px-6 rounded-xl transition-all shadow-md shrink-0 cursor-pointer uppercase font-display font-black tracking-widest border-2 ${
                              userDrillInput.trim()
                                ? 'bg-transparent border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-black hover:shadow-[0_0_20px_rgba(236,72,153,0.8)] hover:scale-105'
                                : 'border-slate-800 text-slate-600 bg-slate-900/30 cursor-not-allowed'
                            }`}
                          >
                            ตรวจคำตอบ (ENTER)
                          </button>
                        ) : (
                          <button
                            onClick={() => generateDrill()}
                            className="h-14 px-6 bg-transparent border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_20px_rgba(16,185,129,0.8)] hover:scale-105 rounded-xl font-black font-display tracking-widest text-sm transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer shrink-0 uppercase"
                          >
                            <span>ข้อถัดไป (NEXT DRILL)</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Display Helpers/Hints when typing */}
                      {!drillChecked && (
                        <div className="flex justify-between items-center text-xs px-1 text-slate-500">
                          <span>ระดับความพยายาม: <b className="font-mono">{drillAttempts}</b></span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (drillTarget) {
                                  const firstLetter = drillTarget[0];
                                  setUserDrillInput(firstLetter);
                                  setDrillAttempts(prev => prev + 1);
                                  setShowToast({
                                    show: true,
                                    title: "💡 ใบ้ตัวแรกให้แล้ว",
                                    desc: `ตัวอักษรตัวแรกคือ "${firstLetter}"`,
                                    icon: "💡"
                                  });
                                  setTimeout(() => setShowToast(null), 2500);
                                }
                              }}
                              className="text-slate-500 hover:text-pink-500 cursor-pointer"
                            >
                              ใบ้อักษรตัวแรก
                            </button>
                            <span>|</span>
                            <button
                              onClick={() => {
                                setDrillChecked(true);
                                setUserDrillInput("");
                                verifyDrillAnswer();
                              }}
                              className="text-slate-500 hover:text-rose-500 cursor-pointer font-medium"
                            >
                              ยอมแพ้ & แสดงเฉลย
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Accuracy Feedback and Comparison Diff */}
                    {drillChecked && (
                      <div className="space-y-4">
                        {renderDrillComparison()}

                        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                          userDrillInput.toUpperCase().trim() === drillTarget.toUpperCase().trim()
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {userDrillInput.toUpperCase().trim() === drillTarget.toUpperCase().trim() ? (
                            <>
                              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-500" />
                              <div>
                                <h4 className="font-bold text-emerald-500">ถอดรหัสถูกต้องสมบูรณ์! (Accuracy: 100%)</h4>
                                <p className="text-xs text-slate-400 mt-0.5">คุณแปลงสัญญาณเสียงมอร์สนี้ได้อย่างแม่นยำไร้ที่ติ!</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-6 h-6 shrink-0 text-rose-500" />
                              <div className="flex-1">
                                <h4 className="font-bold text-rose-500">ผลการถอดรหัสไม่สมบูรณ์ (Accuracy: {
                                  drillHistory.length > 0 ? drillHistory[0].accuracy : 0
                                }%)</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  โจทย์ที่ถูกต้องคือ <strong className="text-pink-500 font-mono tracking-widest text-sm">{drillTarget}</strong> 
                                  {userDrillInput ? ` แต่คุณตอบ ${userDrillInput.toUpperCase()}` : " (ไม่ได้พิมพ์คำตอบ)"}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Right Column: Advanced Options & Interactive Drill History Log */}
                  <div className="lg:col-span-5 space-y-4">
                    
                    {/* Advanced Settings Widget */}
                    <div className={`p-4 rounded-xl border ${
                      theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-1">
                        <Settings className="w-3.5 h-3.5 text-pink-500" />
                        <span>ตัวเลือกเสริมฝึกถอดรหัส</span>
                      </h4>

                      <div className="space-y-3 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={autoPlayNext}
                            onChange={(e) => setAutoPlayNext(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-950 text-pink-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-slate-300 font-medium">เริ่มข้อใหม่แล้วเล่นเสียงให้อัตโนมัติ (Auto-play next)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={autoIncreaseWpm}
                            onChange={(e) => setAutoIncreaseWpm(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-950 text-pink-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-slate-300 font-medium">ความเร็วไต่ระดับอัตโนมัติ (+1 WPM เมื่อผ่าน 100% สำเร็จ)</span>
                        </label>
                      </div>
                    </div>

                    {/* Drill History Logging Table */}
                    <div className={`p-4 rounded-xl border ${
                      theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-pink-500" />
                          <span>บันทึกประวัติการฝึกซ้อมถอดรหัส</span>
                        </h4>
                        {drillHistory.length > 0 && (
                          <button 
                            onClick={() => {
                              setDrillHistory([]);
                              localStorage.removeItem('morse_drill_history');
                            }}
                            className="text-[10px] text-rose-500 hover:text-rose-400 font-bold cursor-pointer"
                          >
                            ล้างประวัติ
                          </button>
                        )}
                      </div>

                      {/* Log table */}
                      <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                        {drillHistory.map((h, idx) => (
                          <div 
                            key={idx}
                            className={`p-2 rounded-lg border flex justify-between items-center font-mono ${
                              h.accuracy === 100 
                                ? 'bg-emerald-500/5 border-emerald-500/20' 
                                : h.accuracy >= 50
                                  ? 'bg-amber-500/5 border-amber-500/20'
                                  : 'bg-rose-500/5 border-rose-500/20'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-pink-500">{h.target}</span>
                              <span className="text-[9px] text-slate-500">ตอบ: {h.input}</span>
                            </div>
                            
                            <div className="flex flex-col items-end">
                              <span className={`font-bold ${
                                h.accuracy === 100 
                                  ? 'text-emerald-500' 
                                  : h.accuracy >= 50 
                                    ? 'text-amber-500' 
                                    : 'text-rose-500'
                              }`}>
                                {h.accuracy}%
                              </span>
                              <span className="text-[8px] text-slate-500">{h.date}</span>
                            </div>
                          </div>
                        ))}

                        {drillHistory.length === 0 && (
                          <div className="text-center py-8 text-slate-500 italic">
                            ยังไม่มีบันทึกประวัติการถอดรหัสในเซสชั่นนี้ เริ่มต้นทำแบบฝึกซ้อมด้านบนเลย!
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 3: FREE TAPPING SIMULATOR */}
          {activeTab === 'keyer' && (
            <div className="space-y-6" id="panel-keyer">
              
              {/* Tap Board simulator */}
              <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="border-b pb-4 mb-4 border-slate-800/40">
                  <h2 className="text-xl font-display font-extrabold flex items-center gap-2">
                    <Keyboard className="w-6 h-6 text-pink-500" />
                    <span>โหมดเคาะคีย์อิสระ (Straight Keyer Simulator)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    ฝึกจังหวะการเคาะส่งรหัสด้วยตัวคุณเอง รองรับการกดปุ่มบนหน้าจอ หรือการกด <b>[Spacebar]</b> บนคีย์บอร์ด
                  </p>
                </div>

                {/* Keyer instructions & timing helper */}
                <div className={`p-3 rounded-xl border text-xs grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ${
                  theme === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div>
                    <h5 className="font-bold text-pink-500 mb-1">📐 ข้อมูลความยาวเวลา (ที่ความเร็ว {wpm} WPM):</h5>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>ความยาว 1 ดอท (Dit): <strong className="text-slate-300 font-mono">{(1200 / wpm).toFixed(0)} ms</strong></li>
                      <li>ความยาว 1 แดช (Dash): <strong className="text-slate-300 font-mono">{(3600 / wpm).toFixed(0)} ms</strong></li>
                      <li>ระบบจะตรวจสอบ ดอท/แดช ที่คาบเวลาเฉลี่ย: <strong className="text-pink-500 font-mono">{(2400 / wpm).toFixed(0)} ms</strong></li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-bold text-pink-500 mb-1">⌨️ วิธีการใช้งาน:</h5>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>สเปซบาร์ใช้เคาะได้เมื่ออยู่บนแท็บนี้ (ไม่มีเคอร์เซอร์โฟกัสช่องพิมพ์)</li>
                      <li>เว้นระยะส่ง <b>3 ยูนิต</b> สรุปอักษร, เว้นส่ง <b>7 ยูนิต</b> สรุปเว้นวรรคคำศัพท์</li>
                    </ul>
                  </div>
                </div>

                {/* Decoded Output Console */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">คอนโซลถอดรหัสสด (Real-time Decoder)</span>
                    {(decodedText || decodedMorse || currentLetterBuffer) && (
                      <button 
                        onClick={clearDecoded}
                        className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ล้างหน้าจอ</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 min-h-[160px] flex flex-col justify-between relative overflow-hidden">
                    {/* Live Tapped morse representation */}
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500">รหัสเคาะดิบ (Morse Symbols):</div>
                      <div className="font-mono text-base md:text-lg text-pink-500 tracking-widest leading-relaxed break-all min-h-[28px]">
                        {decodedMorse}
                        {currentLetterBuffer && (
                          <span className="bg-pink-500/20 text-pink-500 px-1 py-0.5 rounded animate-pulse">
                            {currentLetterBuffer}
                          </span>
                        )}
                        {!decodedMorse && !currentLetterBuffer && (
                          <span className="text-slate-700 italic text-sm">ยังไม่มีข้อมูลสัญญาณ...</span>
                        )}
                      </div>
                    </div>

                    {/* Decoded Plain text translation */}
                    <div className="border-t border-slate-900 pt-4 mt-2">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500">ผลถอดรหัสข้อความ (Decoded Translation):</div>
                      <div className="font-mono text-xl md:text-2xl font-extrabold text-white tracking-widest break-all min-h-[32px]">
                        {decodedText || <span className="text-slate-700 font-sans text-sm font-normal italic">เริ่มต้นเคาะคีย์มอร์ส จะแปลภาษาอังกฤษแสดงที่นี่</span>}
                      </div>
                    </div>

                    {/* Live Tapping speed info indicator */}
                    <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
                      <span>รวมสะสม:</span>
                      <strong className="text-slate-300">{totalTaps} เคาะ</strong>
                    </div>
                  </div>
                </div>

                {/* THE GIANT VIRTUAL straight keyer tapping board */}
                <div className="flex flex-col items-center justify-center py-4">
                  <button
                    onMouseDown={handleKeyerDown}
                    onMouseUp={handleKeyerUp}
                    onMouseLeave={() => { if (isKeyPressed) handleKeyerUp(); }}
                    onTouchStart={(e) => { e.preventDefault(); handleKeyerDown(); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleKeyerUp(); }}
                    className={`w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-75 select-none touch-none shadow-xl cursor-pointer ${
                      isKeyPressed 
                        ? 'bg-gradient-to-br from-pink-500 to-blue-500 text-white scale-95 border-4 border-pink-300 shadow-[0_0_30px_rgba(244,63,94,0.7)]' 
                        : theme === 'dark'
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-4 border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-4 border-slate-300'
                    }`}
                  >
                    <Keyboard className="w-10 h-10 mb-2" />
                    <span className="text-xs font-display font-extrabold uppercase tracking-widest">
                      {isKeyPressed ? 'เสียงดัง...' : 'กดค้างเพื่อส่ง'}
                    </span>
                    <span className="text-[10px] opacity-70 mt-1 font-mono">หรือเคาะ [Spacebar]</span>
                  </button>
                  
                  <div className="text-[10px] text-slate-500 text-center mt-3 leading-relaxed">
                    *กรุณาคลิกพื้นที่ใด ๆ บนหน้าต่างก่อนกดปุ่ม Spacebar เพื่อโฟกัสคีย์บอร์ดให้เรียบร้อย
                  </div>
                </div>

              </div>

              {/* TEXT GENERATOR & HISTORIC SAVES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="panel-text-generator-saves">
                
                {/* Text to play builder */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                  theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <h4 className="font-display font-extrabold text-sm mb-3 text-pink-500 uppercase tracking-wider flex items-center gap-1.5">
                    <BookMarked className="w-4 h-4" />
                    <span>ตัวแปลงข้อความเล่นรหัส (Text to Morse)</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <textarea 
                      placeholder="พิมพ์ข้อความภาษาอังกฤษเพื่อแปลและฝึกฟัง..."
                      value={textGeneratorInput}
                      onChange={(e) => setTextGeneratorInput(e.target.value.toUpperCase())}
                      rows={3}
                      className={`w-full font-mono text-sm p-3 rounded-xl border focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 ${
                        theme === 'dark' 
                          ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-600' 
                          : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
                      }`}
                    />

                    <div className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2 rounded border border-slate-800 break-all leading-relaxed">
                      <strong>ผลแปลมอร์ส:</strong> {textToMorse(textGeneratorInput)}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={playGeneratedMorse}
                        disabled={isPlayingSound || !textGeneratorInput.trim()}
                        className={`flex-1 py-2 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          isPlayingSound || !textGeneratorInput.trim()
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-pink-500 hover:bg-pink-600 text-white shadow-xs'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-white text-white" />
                        <span>เล่นเสียงข้อความ</span>
                      </button>

                      <button
                        onClick={saveGeneratedMessage}
                        disabled={!textGeneratorInput.trim()}
                        className={`py-2 px-4 rounded-xl border font-display font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          !textGeneratorInput.trim()
                            ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                            : theme === 'dark'
                              ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                              : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                        title="บันทึกไว้อ่านภายหลัง"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>บันทึก</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Saved Messages Box */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                  theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <h4 className="font-display font-extrabold text-sm mb-3 text-pink-500 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4" />
                    <span>ข้อความที่บันทึกไว้ (Saved Messages)</span>
                  </h4>

                  <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                    {savedMessages.map((msg, index) => (
                      <div 
                        key={index}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          theme === 'dark' 
                            ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700' 
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <button 
                          onClick={() => loadSavedMessage(msg)}
                          className="flex-1 text-left font-mono font-bold hover:text-pink-500 transition-colors truncate cursor-pointer pr-2"
                          title="คลิกเพื่อเล่นเสียงข้อความนี้"
                        >
                          {msg}
                        </button>
                        
                        <div className="flex items-center gap-2">
                          {/* Copy code button */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg);
                              setShowToast({
                                show: true,
                                title: "📋 คัดลอกสำเร็จ",
                                desc: "คัดลอกข้อความลงคลิปบอร์ดแล้ว",
                                icon: "⚡"
                              });
                              setTimeout(() => setShowToast(null), 2500);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                            title="คัดลอกข้อความ"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={() => deleteSavedMessage(index)}
                            className="text-slate-500 hover:text-rose-500 p-1 cursor-pointer"
                            title="ลบออก"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {savedMessages.length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        ยังไม่มีข้อความบันทึก บันทึกข้อความของคุณได้ทางด้านซ้าย!
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: ACHIEVEMENTS & STATISTICS */}
          {activeTab === 'achievements' && (
            <div className="space-y-6" id="panel-achievements">
              
              {/* Detailed statistical panel */}
              <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h2 className="text-xl font-display font-extrabold border-b pb-3 mb-4 border-slate-800/40 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-pink-500" />
                  <span>สถิติการเล่น & ความสามารถชมรม SPU ARC</span>
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                  <div className={`p-3 rounded-xl text-center border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-[10px] uppercase mb-1">ตอบถูกทั้งหมด</div>
                    <div className="text-2xl font-bold text-emerald-500">{overallStats.totalCorrect}</div>
                  </div>
                  <div className={`p-3 rounded-xl text-center border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-[10px] uppercase mb-1">จำนวนข้อที่ฝึก</div>
                    <div className="text-2xl font-bold text-pink-500">{overallStats.totalRoundsPlayed}</div>
                  </div>
                  <div className={`p-3 rounded-xl text-center border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-[10px] uppercase mb-1">ด่านแคมเปญผ่าน</div>
                    <div className="text-2xl font-bold text-pink-500">
                      {Object.keys(levelStars).filter(k => levelStars[parseInt(k, 10)] > 0).length} / 10 ด่าน
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl text-center border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-slate-400 text-[10px] uppercase mb-1">ยอดเคาะคีย์มอร์ส</div>
                    <div className="text-2xl font-bold text-indigo-400">{totalTaps} taps</div>
                  </div>
                </div>
              </div>

              {/* Achievements Grid */}
              <div className="space-y-4">
                <h3 className="text-lg font-display font-extrabold text-pink-500 uppercase tracking-wider pl-1">
                  เหรียญตราเกเกียรติยศที่ปลดล็อก ({unlockedAchievements.length} / {ACHIEVEMENTS.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ACHIEVEMENTS.map(item => {
                    const isUnlocked = unlockedAchievements.includes(item.id);

                    return (
                      <div 
                        key={item.id}
                        className={`p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${
                          isUnlocked
                            ? theme === 'dark'
                              ? 'bg-slate-900/80 border-pink-500/30 text-white'
                              : 'bg-white border-pink-500/30 text-slate-800 shadow-sm'
                            : theme === 'dark'
                              ? 'bg-slate-900/10 border-slate-800 text-slate-500 opacity-60'
                              : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        {/* Big Trophy circular icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                          isUnlocked 
                            ? 'bg-pink-500/10 text-pink-500 border border-pink-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]' 
                            : 'bg-slate-800 text-slate-600'
                        }`}>
                          {isUnlocked ? item.icon : "🔒"}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-display font-extrabold leading-none ${isUnlocked ? 'text-pink-500' : 'text-slate-400'}`}>
                              {item.thaiTitle}
                            </h4>
                            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">({item.title})</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-tight">{item.thaiDescription}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 italic">เงื่อนไข: {item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: ADMIN CONTROL PANEL */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6 animate-fadeIn" id="panel-admin">
              
              {/* Header card with gold/amber accent */}
              <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                theme === 'dark' ? 'bg-slate-900/60 border-amber-500/20' : 'bg-white border-amber-500/20 shadow-sm'
              }`}>
                {/* Background decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 relative z-10">
                  <div>
                    <h2 className="text-xl font-display font-extrabold flex items-center gap-2 text-amber-500 font-display">
                      <Settings className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
                      <span>แผงควบคุมแอดมิน SPU MORSE CONTROLLER</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      ระบบบริหารจัดการข้อมูลผู้ใช้, สั่งสลับการลงทะเบียนใหม่ (Re-registration), อัปเดตสัญญาณเรียกขาน และส่งรายงานไปยัง Google Sheets
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleExportToCSV}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-amber-500/20 hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>ส่งออก Google Sheets (CSV)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats overview widgets */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border relative overflow-hidden ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">สมาชิกทั้งหมดในระบบ</div>
                  <div className="text-2xl font-black text-amber-400 mt-1 font-mono">{registeredUsers.length} คน</div>
                  <div className="text-[9px] text-slate-500 mt-1">อัปเดตแบบเรียลไทม์</div>
                </div>

                <div className={`p-4 rounded-xl border relative overflow-hidden ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">ต้องการให้ลงทะเบียนใหม่</div>
                  <div className="text-2xl font-black text-rose-500 mt-1 font-mono">
                    {registeredUsers.filter(u => u.needsReRegistration).length} คน
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">สลับสิทธิ์ผู้ที่ข้อมูลไม่อัปเดต</div>
                </div>

                <div className={`p-4 rounded-xl border relative overflow-hidden ${theme === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">มีสัญญาณเรียกขาน (Callsign)</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                    {registeredUsers.filter(u => u.callsign).length} คน
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">ผู้ได้รับใบอนุญาตวิทยุสมัครเล่น</div>
                </div>

                <div className={`p-4 rounded-xl border relative overflow-hidden ${theme === 'dark' ? 'bg-slate-950/60 border-amber-500/20' : 'bg-slate-50 border-amber-500/20'}`}>
                  <div className="text-amber-500 text-[10px] uppercase tracking-wider font-black font-mono">สถานะผู้ดูแลระบบของคุณ</div>
                  <div className="text-sm font-black text-amber-400 mt-2 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 text-center uppercase tracking-widest font-mono">
                    ADMINISTRATOR
                  </div>
                  <div className="text-[8px] text-slate-500 mt-1 text-center font-mono">EMAIL: {currentUser?.email}</div>
                </div>
              </div>

              {/* Search and Main Table Grid */}
              <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                
                {/* Search query box */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                  <h3 className="text-base font-bold text-slate-200 shrink-0 self-start sm:self-auto flex items-center gap-2 font-display">
                    <Users className="w-5 h-5 text-amber-500" />
                    <span>ทำเนียบสมาชิก & เครื่องมือจัดการสิทธิ์</span>
                  </h3>
                  
                  <div className="relative w-full sm:max-w-xs font-sans">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="ค้นหาตามชื่อ, อีเมล หรือ Callsign..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                        theme === 'dark' 
                          ? 'bg-black border-slate-800 text-white placeholder-slate-600 focus:border-amber-500 focus:ring-amber-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:ring-amber-500'
                      }`}
                    />
                    {adminSearchQuery && (
                      <button 
                        onClick={() => setAdminSearchQuery("")}
                        className="absolute right-3 top-2.5 p-0.5 text-slate-500 hover:text-white"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800/40">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className={`text-[10px] font-mono uppercase tracking-wider border-b ${
                        theme === 'dark' ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                        <th className="py-3.5 px-4 font-bold">ข้อมูลผู้ใช้ / ชื่อสมาชิก</th>
                        <th className="py-3.5 px-4 font-bold">อีเมลใช้งาน</th>
                        <th className="py-3.5 px-4 font-bold text-center">สัญญาณเรียกขาน</th>
                        <th className="py-3.5 px-4 font-bold text-center">วันที่ลงทะเบียน</th>
                        <th className="py-3.5 px-4 font-bold text-center">สถานะข้อมูล</th>
                        <th className="py-3.5 px-4 font-bold text-right">เครื่องมือผู้ดูแลระบบ (Actions)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/20 text-xs">
                      {registeredUsers
                        .filter(u => {
                          const q = adminSearchQuery.toLowerCase();
                          return u.name.toLowerCase().includes(q) || 
                                 u.email.toLowerCase().includes(q) || 
                                 (u.callsign && u.callsign.toLowerCase().includes(q));
                        })
                        .map((user, idx) => {
                          const isUserAdmin = user.email.toLowerCase() === "kittapat.chi@spumail.net" || user.role === "admin";
                          return (
                            <tr 
                              key={user.email} 
                              className={`hover:bg-amber-500/[0.02] transition-colors ${
                                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                              }`}
                            >
                              {/* Name with Avatar */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-inner ${
                                    theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'
                                  }`}>
                                    {user.avatar || "🦊"}
                                  </div>
                                  <div>
                                    <div className="font-extrabold flex items-center gap-1.5 font-sans text-white">
                                      <span>{user.name}</span>
                                      {isUserAdmin && (
                                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                                          ADMIN
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wide">
                                      ID: {user.uid ? user.uid.substring(0, 8) + "..." : `LOCAL-${idx}`}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="py-4 px-4 font-mono text-slate-400">
                                {user.email}
                              </td>

                              {/* Callsign badge */}
                              <td className="py-4 px-4 text-center">
                                {user.callsign ? (
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-lg font-mono font-black text-xs tracking-wide">
                                    {user.callsign}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic font-mono">- ไม่มี -</span>
                                )}
                              </td>

                              {/* Registered Date */}
                              <td className="py-4 px-4 text-center font-mono text-[10px] text-slate-400">
                                {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : "ไม่ระบุ"}
                              </td>

                              {/* Status check */}
                              <td className="py-4 px-4 text-center">
                                {user.needsReRegistration ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="bg-rose-500/10 text-rose-500 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      ⚠️ ต้องลงทะเบียนใหม่
                                    </span>
                                    {user.reRegistrationReason && (
                                      <span className="text-[9px] text-rose-400/80 mt-1 max-w-[150px] truncate" title={user.reRegistrationReason}>
                                        {user.reRegistrationReason}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    ✅ สมบูรณ์เรียบร้อย
                                  </span>
                                )}
                              </td>

                              {/* Admin Tools Actions */}
                              <td className="py-4 px-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  {/* Toggle Re-Registration button */}
                                  <button
                                    onClick={() => handleToggleReRegistration(user.email)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                                      user.needsReRegistration
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                                        : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                                    }`}
                                    title={user.needsReRegistration ? "ยกเลิกคำขอให้ลงทะเบียนใหม่" : "ขอให้ผู้ใช้ลงทะเบียนใหม่"}
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>{user.needsReRegistration ? "ยืนยันผ่าน" : "ขอข้อมูลใหม่"}</span>
                                  </button>

                                  {/* Update Callsign button */}
                                  <button
                                    onClick={() => handleAdminUpdateCallsign(user.email)}
                                    className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="แก้ไขสัญญาณเรียกขาน"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>แก้ Callsign</span>
                                  </button>

                                  {/* Delete user button */}
                                  <button
                                    onClick={() => handleAdminDeleteUser(user.email)}
                                    disabled={isUserAdmin}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                                      isUserAdmin 
                                        ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700' 
                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                                    }`}
                                    title="ลบสมาชิกออกจากระบบ"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>ลบ</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {registeredUsers.filter(u => {
                        const q = adminSearchQuery.toLowerCase();
                        return u.name.toLowerCase().includes(q) || 
                               u.email.toLowerCase().includes(q) || 
                               (u.callsign && u.callsign.toLowerCase().includes(q));
                      }).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500 font-mono italic">
                            ไม่พบรายชื่อสมาชิกที่ค้นหาด้วยรหัสหรือคีย์เวิร์ด "{adminSearchQuery}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          )}

        </section>

      </main>

      {/* FOOTER SECTION */}
      <footer className="h-12 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between px-8 text-[10px] text-slate-500 font-bold tracking-wider shrink-0 py-2 sm:py-0" id="footer-main">
        <div className="text-center sm:text-left">© 2026 SRIPATUM UNIVERSITY AMATEUR RADIO CLUB. ALL RIGHTS RESERVED.</div>
        <div className="text-slate-300 text-center sm:text-right mt-1 sm:mt-0 uppercase font-mono">DESIGNED & DEVELOPED BY E25DUV</div>
      </footer>

    </div>
  );
}
