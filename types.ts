export interface Trip {
  id: string;
  name: string;
  subtitle?: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  memberUids: string[]; // Firebase Auth UIDs
  ownerUid: string;
  createdAt: string;
  city?: string;
  country?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  themeColor?: string;
  motto?: string;
  location?: string;
  interests?: string[];
  profileTheme?: 'hipster' | 'minimalist' | 'scrapbook';
}

export interface Member {
  id: string; // This will now map to UserProfile.uid
  name: string;
  color: string;
  avatar: string;
}

export enum Tab {
  SCHEDULE = 'SCHEDULE',
  EXPENSE = 'EXPENSE',
  JOURNAL = 'JOURNAL',
  PLANNING = 'PLANNING'
}

export enum MainTab {
  HOME = 'HOME',
  TRIPS = 'TRIPS',
  ADD = 'ADD',
  PROFILE = 'PROFILE'
}

export enum EventCategory {
  SIGHTSEEING = '景點',
  FOOD = '美食',
  TRANSPORT = '交通',
  STAY = '住宿',
  SHOPPING = '購物',
  STAR = '收藏'
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  location: string;
  category: EventCategory;
  notes?: string;
  mapLink?: string;
  createdAt?: string;
}

export interface PreTripTask {
  id: string;
  title: string;
  completedBy: string[]; // List of member IDs who finished this
  createdAt?: string;
}

export interface Expense {
  id: string;
  amountKRW: number;
  amountTWD: number;
  currency: 'KRW' | 'TWD'; // Track original input currency
  category: string;
  description: string;
  payerId: string;
  splitWithIds: string[]; // IDs of members involved
  date: string;
  time?: string;
  notes?: string;
  customSplits?: Record<string, number>;
  timestamp?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  authorId: string;
  photos?: string[];
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  ownerId: string;
  type: 'todo' | 'packing' | 'shopping';
  createdAt?: string;
  location?: string;
  image?: string;
}
